from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import fitz  # PyMuPDF

# Configure logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection - use get() with defaults to avoid crashes
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'pdf_timer_db')

# Global variables for database connection
client: AsyncIOMotorClient = None
db = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    global client, db

    # Startup
    try:
        logger.info("Connecting to MongoDB...")
        client = AsyncIOMotorClient(
            mongo_url,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000
        )
        # Test connection
        await client.admin.command('ping')
        db = client[db_name]

        # Create indexes
        await db.pdf_analyses.create_index([("timestamp", -1)])
        await db.status_checks.create_index([("timestamp", -1)])
        logger.info("Database indexes created successfully")
        logger.info("MongoDB connection established successfully")
    except Exception as e:
        logger.warning(f"MongoDB connection failed: {e}. App will run without database.")
        # Create a None db so the app can still serve static endpoints
        db = None

    yield

    # Shutdown
    if client:
        client.close()
        logger.info("MongoDB connection closed")


# Create the main app with lifespan
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Constants
WORDS_PER_MINUTE = 180
QUESTION_ANSWER_TIME = 35  # seconds

# Define Models
class QuestionInfo(BaseModel):
    text: str
    answer_time: int = QUESTION_ANSWER_TIME
    is_final_question: bool = False  # Questions that precede "¿QUÉ RESPONDERÍAS?"
    parenthesis_content: str = ""  # Content inside parentheses after the question
    content_type: str = ""  # "image" if contains "Vea también", "scripture" if contains bible reference, "" otherwise

class ParagraphAnalysis(BaseModel):
    number: int
    text: str
    word_count: int
    reading_time_seconds: float
    questions: List[QuestionInfo] = []
    total_time_seconds: float
    cumulative_time_seconds: float = 0  # Time from start to end of this paragraph
    grouped_with: List[int] = []  # List of paragraph numbers grouped together (e.g., [1, 2] for "1, 2." questions)

class PDFAnalysisResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    total_words: int
    total_paragraphs: int
    total_questions: int
    total_reading_time_seconds: float
    total_question_time_seconds: float
    total_time_seconds: float = 3600  # Always 60 minutes (3600 seconds)
    fixed_duration: bool = True  # Indicates duration is fixed at 60 min
    final_questions_start_time: float = 0  # When final questions section starts
    final_questions: List[QuestionInfo] = []  # Questions after horizontal line separator
    final_questions_title: str = ""  # Bold title/question before the final questions
    paragraphs: List[ParagraphAnalysis]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # New counters for extra content
    total_paragraph_questions: int = 0  # Questions in paragraphs (not final)
    total_review_questions: int = 0  # Final review questions
    total_images: int = 0  # Questions with image references
    total_scriptures: int = 0  # Questions with scripture references
    total_notes: int = 0  # Questions with note references

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str


class TextLine:
    """Represents a line of text with its font size"""
    def __init__(self, text: str, font_size: float):
        self.text = text.strip()
        self.font_size = font_size

    def __repr__(self):
        return f"TextLine({self.font_size:.1f}: {self.text[:50]}...)"


def extract_text_with_sizes(pdf_bytes: bytes) -> List[TextLine]:
    """Extract text from PDF with font size information using PyMuPDF.
    Returns individual spans to preserve font size information."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    lines = []

    for page in doc:
        blocks = page.get_text('dict')['blocks']
        for block in blocks:
            if 'lines' in block:
                for line in block['lines']:
                    for span in line['spans']:
                        text = span['text'].strip()
                        size = span['size']
                        if text:
                            lines.append(TextLine(text, round(size, 1)))

    doc.close()
    return lines


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


def split_into_paragraphs(text: str) -> List[str]:
    """
    Split text into paragraphs based on paragraph numbers at the start of lines.
    Paragraphs are identified by a number at the beginning (e.g., "1 Texto..." or "2 Texto...")
    Questions that start with the same number belong to that paragraph.
    Lines without numbers are joined to the current paragraph.
    """
    paragraphs = []

    # First, try to split by paragraph numbers at the start of lines
    lines = text.split('\n')
    current_paragraph_lines = []
    current_number = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check if line starts with a number followed by space or period (paragraph marker)
        # Matches: "1 Text", "2 Text", "1, 2 Text", "1. Text", etc.
        match = re.match(r'^(\d+(?:\s*,\s*\d+)*)[.\s]+(.+)$', line)

        if match:
            num_str = match.group(1)
            content = match.group(2)

            # Get the first number in case of grouped paragraphs like "1, 2"
            first_num = int(re.match(r'\d+', num_str).group())

            # Check if this is a question line (contains ¿ or ends with ?)
            is_question = '¿' in content or content.endswith('?')

            if is_question:
                # This is a question - it belongs to the current paragraph
                if current_paragraph_lines:
                    current_paragraph_lines.append(line)
            else:
                # This is a new paragraph (not a question)
                if current_paragraph_lines:
                    # Join all lines of the current paragraph with spaces
                    paragraph_text = ' '.join(current_paragraph_lines)
                    # Clean up extra spaces
                    paragraph_text = re.sub(r'\s+', ' ', paragraph_text).strip()
                    paragraphs.append(paragraph_text)
                current_paragraph_lines = [line]
                current_number = first_num
        else:
            # Line doesn't start with number - continue current paragraph
            # Join with current paragraph (this handles wrapped text)
            if current_paragraph_lines:
                current_paragraph_lines.append(line)
            else:
                current_paragraph_lines = [line]

    # Add the last paragraph
    if current_paragraph_lines:
        paragraph_text = ' '.join(current_paragraph_lines)
        paragraph_text = re.sub(r'\s+', ' ', paragraph_text).strip()
        paragraphs.append(paragraph_text)

    # If no numbered paragraphs found, fall back to double newline split
    if len(paragraphs) <= 1 and '\n\n' in text:
        paragraphs = re.split(r'\n\s*\n+', text.strip())
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        # Clean up each paragraph
        paragraphs = [re.sub(r'\s+', ' ', p).strip() for p in paragraphs]

    return paragraphs if paragraphs else [text.strip()]


def clean_hyphenated_text(text: str) -> str:
    """
    Remove word-break hyphens from text.
    Example: "ima- gen" -> "imagen", "tam- bién" -> "también"
    """
    # Replace hyphen followed by space and lowercase letter
    return re.sub(r'-\s+([a-záéíóúñ])', r'\1', text)


def extract_question_with_parenthesis(question_text: str) -> dict:
    """
    Extract question text and any content in parentheses after the question.
    Classifies the parenthesis content:
    - "image" if contains "Vea también la imagen", "Vea también las imágenes", "ilustración"
    - "scripture" if contains bible reference pattern (e.g., Salmos 32:17, Juan 3:16)
    - "note" if contains "Vea también la nota", "nota"
    - "both" if contains BOTH image reference AND scripture
    - "" if no special content

    Returns dict with:
    - text: the question text
    - parenthesis_content: content inside parentheses
    - content_type: "image", "scripture", "note", "both", or ""
    """
    # First clean any hyphenated words in the input
    question_text = clean_hyphenated_text(question_text)

    result = {
        "text": question_text.strip(),
        "parenthesis_content": "",
        "content_type": ""
    }

    # Pattern to find parentheses content after the question
    # Match content like: "¿Pregunta? (Vea también la imagen)" or "¿Pregunta? (Salmos 32:17)"
    paren_match = re.search(r'\?\s*\(([^)]+)\)', question_text)

    if paren_match:
        paren_content = paren_match.group(1).strip()
        result["parenthesis_content"] = paren_content

        # Remove the parenthesis from the question text for cleaner display
        result["text"] = question_text[:paren_match.start() + 1].strip()

        # Classify the content
        result["content_type"] = classify_parenthesis_content(paren_content)
    else:
        # Also check for parentheses anywhere in the question
        paren_match_anywhere = re.search(r'\(([^)]+)\)', question_text)
        if paren_match_anywhere:
            paren_content = paren_match_anywhere.group(1).strip()

            # Check if it's a meaningful reference (not just a number or short text)
            if len(paren_content) > 3:
                result["parenthesis_content"] = paren_content

                # Remove parenthesis from text
                result["text"] = question_text.replace(f'({paren_content})', '').strip()

                # Classify the content
                result["content_type"] = classify_parenthesis_content(paren_content)

    return result


def classify_parenthesis_content(paren_content: str) -> str:
    """
    Classify the content inside parentheses.
    Returns: "image", "scripture", "note", "both", or ""
    """
    paren_lower = paren_content.lower()

    # Check for note reference - "vea también la nota", "vea la nota"
    has_note = bool(re.search(r'[Vv]ea\s*(también\s+)?la\s+nota', paren_content, re.IGNORECASE))

    # Check for image reference - but NOT if it's a note
    # "vea también la imagen", "vea también las imágenes", "vea la ilustración", "imagen", "imágenes"
    has_image = False
    if not has_note:
        # Pattern for "Vea (también) (la/las) imagen/imágenes/ilustración/ilustraciones"
        has_image = bool(re.search(r'[Vv]ea\s*(también\s+)?(la\s+|las\s+)?(im[aá]gen(es)?|ilustraci[oó]n(es)?)', paren_content, re.IGNORECASE))
        # Also check for standalone words
        if not has_image:
            has_image = bool(re.search(r'^(im[aá]gen(es)?|ilustraci[oó]n(es)?)$', paren_content.strip(), re.IGNORECASE))
        # Also check for generic "Vea también" without specific word (usually means image)
        if not has_image:
            has_image = bool(re.search(r'^[Vv]ea\s+también\s*$', paren_content.strip(), re.IGNORECASE))

    # Check for scripture reference with multiple patterns:
    # 1. "lea/Lea/LEA/léalo/Léalo" followed by book name and chapter:verse - e.g., "lea 2 Pedro 3:9", "Lea Salmo 138:6"
    # 2. Standard format - "Salmos 32:17", "Juan 3:16", "1 Corintios 13:4"
    # 3. Format without space - "Salmo62:8", "Marcos3:1-6"
    has_scripture = False

    # Pattern 1: Starts with "lea", "Lea", "LEA", "léalo", "Léalo", "LÉALO" followed by scripture
    if re.search(r'^[Ll][EeÉé][Aa](lo|LO)?\s+', paren_content):
        # Extract the part after "lea/léalo" and check if it looks like a scripture
        scripture_part = re.sub(r'^[Ll][EeÉé][Aa](lo|LO)?\s+', '', paren_content)
        # Check for chapter:verse pattern (with or without space before numbers)
        if re.search(r'\d+:\d+', scripture_part):
            has_scripture = True

    # Pattern 2: Standard format with space - "Salmos 32:17", "Juan 3:16"
    if not has_scripture:
        has_scripture = bool(re.search(r'[A-Za-záéíóúÁÉÍÓÚñÑ]+\s+\d+:\d+', paren_content))

    # Pattern 3: Format without space - "Salmo62:8", "Marcos3:1-6"
    if not has_scripture:
        has_scripture = bool(re.search(r'[A-Za-záéíóúÁÉÍÓÚñÑ]+\d+:\d+', paren_content))

    # Classify based on what was found
    if has_note:
        return "note"
    elif has_image and has_scripture:
        return "both"
    elif has_image:
        return "image"
    elif has_scripture:
        return "scripture"

    return ""


def extract_lea_scriptures_from_text(text: str) -> List[dict]:
    """
    Extract scripture references that start with "lea/Lea/LEA/léalo" from paragraph text.
    These are inline scripture references that should be counted as extra content.

    Returns a list of dicts with:
    - parenthesis_content: the full content (e.g., "lea Salmo 62:8")
    - content_type: "scripture"
    """
    scriptures = []

    # Pattern to find (lea/Lea/léalo followed by scripture reference)
    # Matches: (lea Salmo 62:8), (Lea Salmo 138:6), (lea 2 Pedro 3:9), (lea Marcos3:1-6)
    pattern = r'\(([Ll][EeÉé][Aa](?:lo|LO)?\s+[^)]+\d+:\d+[^)]*)\)'

    matches = re.findall(pattern, text)

    for match in matches:
        # Verify it contains a scripture reference (chapter:verse pattern)
        if re.search(r'\d+:\d+', match):
            scriptures.append({
                "parenthesis_content": match.strip(),
                "content_type": "scripture"
            })

    return scriptures


def create_question_info(question_text: str, answer_time: int, is_final_question: bool = False) -> QuestionInfo:
    """
    Helper function to create QuestionInfo with parenthesis extraction.
    Uses extract_question_with_parenthesis to extract and classify content in parentheses.
    """
    extracted = extract_question_with_parenthesis(question_text)
    return QuestionInfo(
        text=extracted["text"],
        answer_time=answer_time,
        is_final_question=is_final_question,
        parenthesis_content=extracted["parenthesis_content"],
        content_type=extracted["content_type"]
    )


def join_hyphenated_lines(parts: List[str]) -> str:
    """
    Join lines of text, handling hyphenated word breaks.
    Example: ["ima-", "gen de la portada"] -> "imagen de la portada"
    """
    if not parts:
        return ""

    result = []
    for i, part in enumerate(parts):
        part = part.strip()
        if not part:
            continue

        if result and result[-1].endswith('-'):
            # Previous part ended with hyphen - join without space
            result[-1] = result[-1][:-1] + part
        else:
            result.append(part)

    return ' '.join(result)


def process_pdf_with_font_sizes(pdf_bytes: bytes) -> dict:
    """
    Process PDF using font size information to distinguish paragraphs from questions.
    Questions are identified by:
    1. Starting with number(s) followed by "." (e.g., "1.", "12.")
    2. Having smaller font size than paragraph text
    """
    lines = extract_text_with_sizes(pdf_bytes)

    if not lines:
        return {"paragraphs": [], "questions_by_paragraph": {}}

    # Calculate the most common (mode) font size - this is likely the paragraph text size
    size_counts = {}
    for line in lines:
        size_key = round(line.font_size, 1)
        size_counts[size_key] = size_counts.get(size_key, 0) + 1

    # Find the dominant font size (paragraph text)
    paragraph_font_size = max(size_counts.keys(), key=lambda k: size_counts[k])

    # Tolerance for font size comparison (allow small variations)
    size_tolerance = 0.5

    paragraphs = []
    questions_by_paragraph = {}
    current_paragraph_lines = []
    current_paragraph_number = None

    for line in lines:
        text = line.text
        font_size = line.font_size

        if not text:
            continue

        # Check if line starts with number(s) followed by period: "1." or "12."
        # Pattern: one or two digits followed by "."
        question_pattern = re.match(r'^(\d{1,2})\.\s*(.+)$', text)

        # Check if line starts with number followed by space (paragraph start): "1 Texto"
        paragraph_pattern = re.match(r'^(\d{1,2})\s+([^.?¿].*)$', text)

        # Determine if this is a question based on:
        # 1. Matches question pattern (number + period)
        # 2. Has smaller font size than paragraph text
        # 3. Contains question marks
        is_smaller_font = font_size < (paragraph_font_size - size_tolerance)
        has_question_mark = '¿' in text or text.endswith('?')

        if question_pattern:
            question_num = int(question_pattern.group(1))
            question_text = question_pattern.group(2).strip()

            # This is likely a question if it has smaller font OR contains question marks
            if is_smaller_font or has_question_mark:
                # Add to questions for this paragraph number
                if question_num not in questions_by_paragraph:
                    questions_by_paragraph[question_num] = []
                questions_by_paragraph[question_num].append(question_text)

                # Also add to current paragraph text for display
                if current_paragraph_lines:
                    current_paragraph_lines.append(text)
                continue

        if paragraph_pattern:
            para_num = int(paragraph_pattern.group(1))
            para_text = paragraph_pattern.group(2).strip()

            # This looks like a paragraph start (number + space + non-question text)
            if not is_smaller_font and not has_question_mark:
                # Save previous paragraph
                if current_paragraph_lines:
                    paragraphs.append('\n'.join(current_paragraph_lines))

                # Start new paragraph
                current_paragraph_lines = [text]
                current_paragraph_number = para_num
                continue

        # Default: add to current paragraph
        if current_paragraph_lines:
            current_paragraph_lines.append(text)
        else:
            current_paragraph_lines = [text]

    # Save last paragraph
    if current_paragraph_lines:
        paragraphs.append('\n'.join(current_paragraph_lines))

    return {
        "paragraphs": paragraphs,
        "questions_by_paragraph": questions_by_paragraph,
        "paragraph_font_size": paragraph_font_size,
        "detected_sizes": dict(size_counts)
    }


def detect_horizontal_line_separator(pdf_bytes: bytes) -> dict:
    """
    Detect horizontal line separator in PDF that marks the start of final questions section.
    Returns information about the line position.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        last_line_page = -1
        last_line_y = -1

        for page_num in range(len(doc)):
            page = doc[page_num]
            page_height = page.rect.height
            drawings = page.get_drawings()

            for drawing in drawings:
                rect = drawing.get('rect')
                if rect:
                    width = rect.width
                    height = rect.height
                    # Horizontal line: wide (>200) and short (<5)
                    if width > 200 and height < 5:
                        # Check if it's in the lower portion of the page
                        if rect.y0 > page_height * 0.3:
                            last_line_page = page_num
                            last_line_y = rect.y0

                # Also check line paths
                items = drawing.get('items', [])
                for item in items:
                    if item[0] == 'l':  # Line
                        start = item[1]
                        end = item[2]
                        if abs(start.y - end.y) < 2:  # Horizontal
                            line_width = abs(end.x - start.x)
                            if line_width > 200 and start.y > page_height * 0.3:
                                last_line_page = page_num
                                last_line_y = start.y

        doc.close()

        return {
            "found": last_line_page >= 0,
            "page": last_line_page,
            "y_position": last_line_y
        }
    except Exception as e:
        logging.warning(f"Error detecting horizontal line: {e}")
        return {"found": False, "page": -1, "y_position": -1}


def extract_questions_after_horizontal_line(pdf_bytes: bytes, line_info: dict) -> tuple:
    """
    Extract questions that appear after the horizontal line separator.
    These are the final discussion questions (Preguntas de Repaso).

    Returns a tuple: (list of QuestionInfo, bold title string)

    The format can be:
    1. Traditional: "1. ¿Pregunta?" numbered questions
    2. Bullet points: A main question followed by bullet points (˛)
    """
    final_questions = []
    bold_title = ""

    if not line_info.get("found"):
        return final_questions, bold_title

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        line_page = line_info["page"]
        line_y = line_info["y_position"]

        text_items = []  # List of (y_pos, font_size, text, is_bold)

        # Get text from the page with the line, below the line
        if line_page >= 0 and line_page < len(doc):
            page = doc[line_page]
            blocks = page.get_text('dict')['blocks']

            for block in blocks:
                if 'lines' in block:
                    for line in block['lines']:
                        for span in line['spans']:
                            text = span['text'].strip()
                            font_size = span['size']
                            y_pos = span['bbox'][1]
                            flags = span.get('flags', 0)
                            is_bold = bool(flags & 16)  # Bold flag
                            # Only include text that starts below the line
                            if y_pos > line_y + 5 and text:
                                text_items.append((y_pos, font_size, text, is_bold))

        # Also get text from pages after the line page
        for page_num in range(line_page + 1, len(doc)):
            page = doc[page_num]
            blocks = page.get_text('dict')['blocks']
            for block in blocks:
                if 'lines' in block:
                    for line in block['lines']:
                        for span in line['spans']:
                            text = span['text'].strip()
                            font_size = span['size']
                            y_pos = span['bbox'][1]
                            flags = span.get('flags', 0)
                            is_bold = bool(flags & 16)
                            if text:
                                text_items.append((y_pos + (page_num - line_page) * 1000, font_size, text, is_bold))

        doc.close()

        # Sort by position
        text_items.sort(key=lambda x: x[0])

        # Parse the questions
        bullet_points = []
        numbered_questions = []

        for y_pos, font_size, text, is_bold in text_items:
            # Skip song references at the end - "CANCIÓN" followed by space and number
            text_upper = text.upper()
            if re.match(r'^CANCI[OÓ]N\s+\d+', text_upper):
                break

            # Skip bullet character alone
            if text == '˛':
                continue

            # Capture the first bold text as the title (if it contains ?)
            if is_bold and not bold_title and '?' in text:
                bold_title = text
                continue

            # Skip any other all-caps headers
            if text.isupper() and '?' in text:
                continue

            # Check for traditional numbered format: "1. ¿Pregunta?"
            match = re.match(r'^(\d{1,2})\.\s*(.+\?)$', text)
            if match:
                question_text = match.group(2).strip()
                if len(question_text) > 3:
                    numbered_questions.append(question_text)
            # Bullet point items (short phrases, not numbered)
            elif len(text) > 2 and len(text) < 150 and not text[0].isdigit():
                # Check if it looks like a question or topic (names start with uppercase)
                if '?' in text or (len(text) > 2 and text[0].isupper()):
                    bullet_points.append(text)

        # Prefer numbered questions if found
        if numbered_questions:
            for q in numbered_questions:
                final_questions.append(create_question_info(q, QUESTION_ANSWER_TIME, True))
        # Otherwise use bullet points
        elif bullet_points:
            for point in bullet_points:
                final_questions.append(create_question_info(point, QUESTION_ANSWER_TIME, True))

        return final_questions, bold_title

    except Exception as e:
        logging.warning(f"Error extracting questions after horizontal line: {e}")
        return final_questions, bold_title


def count_words(text: str) -> int:
    """Count words in text"""
    words = re.findall(r'\b\w+\b', text)
    return len(words)


def calculate_reading_time(word_count: int, wpm: int = WORDS_PER_MINUTE) -> float:
    """Calculate reading time in seconds based on configurable words per minute"""
    return (word_count / wpm) * 60


def detect_questions(text: str, paragraph_number: int, is_final_question: bool = False) -> List[QuestionInfo]:
    """
    Detect questions in paragraph that start with the paragraph number.
    Formats supported (in order of priority):
    - "6. ¿Cómo podría...?" (number + period + question) - PRIMARY FORMAT
    - "6. Cómo podría...?" (number + period + question without ¿)
    - "6 ¿Cómo podría...?" (number + space + question)
    Ignores "¿QUÉ RESPONDERÍAS?"
    """
    questions = []

    # Questions to ignore (case-insensitive)
    IGNORED_PATTERNS = [
        "qué responderías",
        "que responderias",
        "qué responderías?",
        "que responderias?",
    ]

    def is_ignored_question(q_text: str) -> bool:
        """Check if question should be ignored"""
        q_lower = q_text.lower().strip()
        # Remove ¿ and ? for comparison
        q_clean = q_lower.replace('¿', '').replace('?', '').strip()
        for ignored in IGNORED_PATTERNS:
            ignored_clean = ignored.replace('¿', '').replace('?', '').strip()
            if ignored_clean in q_clean or q_clean in ignored_clean:
                return True
        return False

    # Split text into lines to find question lines
    lines = text.split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Pattern 1 (PRIMARY): "6. pregunta?" - number followed by period (with or without ¿)
        # This matches: "6. ¿Cómo...?" or "6. Cómo...?"
        pattern_period = rf'^{paragraph_number}\.\s*(.+)$'

        # Pattern 2: "6 ¿pregunta?" - number followed by space and question mark
        pattern_space = rf'^{paragraph_number}\s+(.+)$'

        # Pattern 3: "6) pregunta?" or "6- pregunta?"
        pattern_other = rf'^{paragraph_number}[\)\-:]\s*(.+)$'

        # Try patterns in order of priority (period first as per user's format)
        match = re.match(pattern_period, line, re.IGNORECASE)
        if not match:
            match = re.match(pattern_space, line, re.IGNORECASE)
        if not match:
            match = re.match(pattern_other, line, re.IGNORECASE)

        if match:
            question_text = match.group(1).strip()
            # Skip ignored questions like "¿QUÉ RESPONDERÍAS?"
            if is_ignored_question(question_text):
                continue
            if len(question_text) > 5:
                questions.append(create_question_info(question_text, QUESTION_ANSWER_TIME, is_final_question))

    return questions


def extract_final_questions(text: str, pdf_bytes: bytes = None) -> List[QuestionInfo]:
    """
    Extract questions that appear AFTER the horizontal line separator at the bottom.
    These are the final discussion questions (Preguntas de Repaso).

    The function first tries to detect a horizontal line in the PDF graphics.
    If pdf_bytes is provided, it uses the line position to find questions after it.
    Otherwise, falls back to text-based detection.
    """
    final_questions = []

    # Try to find horizontal line separator using PDF graphics
    if pdf_bytes:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")

            # Find the last significant horizontal line in the document
            last_line_page = -1
            last_line_y = -1

            for page_num in range(len(doc)):
                page = doc[page_num]
                page_height = page.rect.height
                drawings = page.get_drawings()

                for drawing in drawings:
                    rect = drawing.get('rect')
                    if rect:
                        width = rect.width
                        height = rect.height
                        # Horizontal line: wide (>200) and short (<5)
                        if width > 200 and height < 5:
                            # Check if it's in the lower half of the page (likely separator)
                            if rect.y0 > page_height * 0.3:
                                last_line_page = page_num
                                last_line_y = rect.y0

                    # Also check line paths
                    items = drawing.get('items', [])
                    for item in items:
                        if item[0] == 'l':  # Line
                            start = item[1]
                            end = item[2]
                            if abs(start.y - end.y) < 2:  # Horizontal
                                line_width = abs(end.x - start.x)
                                if line_width > 200 and start.y > page_height * 0.3:
                                    last_line_page = page_num
                                    last_line_y = start.y

            # If we found a horizontal line, extract text after it
            if last_line_page >= 0 and last_line_y > 0:
                # Get all text from the page with the line, below the line
                page = doc[last_line_page]

                # Get text blocks with position info
                blocks = page.get_text('dict')['blocks']
                text_after_line = []

                for block in blocks:
                    if 'lines' in block:
                        block_top = block.get('bbox', [0, 0, 0, 0])[1]
                        # Only include text that starts below the line
                        if block_top > last_line_y + 5:
                            for line in block['lines']:
                                line_text = ''
                                for span in line['spans']:
                                    line_text += span['text']
                                if line_text.strip():
                                    text_after_line.append(line_text.strip())

                # Also get text from pages after the line page
                for page_num in range(last_line_page + 1, len(doc)):
                    page_text = doc[page_num].get_text()
                    for line in page_text.split('\n'):
                        if line.strip():
                            text_after_line.append(line.strip())

                doc.close()

                # Parse questions from text after the line
                for line in text_after_line:
                    # Pattern: "número. pregunta?" - one or two digits, period, then question
                    match = re.match(r'^(\d{1,2})\.\s*(.+\?)$', line, re.IGNORECASE)
                    if match:
                        question_text = match.group(2).strip()
                        if len(question_text) > 5:
                            final_questions.append(create_question_info(question_text, QUESTION_ANSWER_TIME, True))

                if final_questions:
                    return final_questions
            else:
                doc.close()
        except Exception as e:
            logging.warning(f"Error detecting horizontal line: {e}")

    # Fallback: Try to find questions after "¿QUÉ RESPONDERÍAS?" marker
    text_lower = text.lower()
    marker_patterns = [
        "¿qué responderías?",
        "que responderias?",
        "¿qué responderías",
        "que responderias",
        "¿qué respondería?",
        "que responderia?"
    ]

    marker_pos = -1
    for pattern in marker_patterns:
        pos = text_lower.find(pattern)
        if pos != -1:
            marker_pos = pos
            break

    if marker_pos == -1:
        return final_questions

    # Get text after the marker
    after_marker = text[marker_pos:]
    newline_pos = after_marker.find('\n')
    if newline_pos != -1:
        text_after = after_marker[newline_pos + 1:]
    else:
        text_after = ""

    if not text_after.strip():
        return final_questions

    # Find all questions in the text after the marker
    lines = text_after.split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        match = re.match(r'^(\d{1,2})\.\s*(.+\?)$', line, re.IGNORECASE)
        if match:
            question_text = match.group(2).strip()
            if len(question_text) > 5:
                final_questions.append(create_question_info(question_text, QUESTION_ANSWER_TIME, True))

    return final_questions


def analyze_pdf_with_font_info(pdf_bytes: bytes, filename: str) -> PDFAnalysisResult:
    """
    Analyze PDF using font size information to detect questions.

    Format detected from Watchtower Study articles:
    - Paragraphs: Start with number in bold (size ~6.8), text in size ~11.0
    - Questions: Size ~9.0, number in medium/bold font, text in regular font
    - Question format: "1, 2." or "14, 15." for multiple paragraphs
    - Questions may span multiple lines at size 9.0
    - Final questions: After horizontal line separator at the bottom
    """
    lines = extract_text_with_sizes(pdf_bytes)

    if not lines:
        text = extract_text_from_pdf(pdf_bytes)
        return analyze_pdf_content(text, filename)

    # Detect horizontal line position for final questions section
    horizontal_line_info = detect_horizontal_line_separator(pdf_bytes)

    # Identify font sizes used in document
    size_counts = {}
    for line in lines:
        size_key = round(line.font_size, 1)
        size_counts[size_key] = size_counts.get(size_key, 0) + 1

    if not size_counts:
        text = extract_text_from_pdf(pdf_bytes)
        return analyze_pdf_content(text, filename)

    # First pass: Group consecutive question lines (size ~9.0)
    # This handles questions that span multiple lines
    grouped_lines = []
    current_question_parts = []
    current_question_nums = None

    for line in lines:
        text = line.text.strip()
        font_size = round(line.font_size, 1)

        if not text:
            continue

        is_question_size = 8.5 <= font_size <= 9.5

        if is_question_size:
            # Check if this line starts with paragraph numbers (e.g., "4." or "1, 2.")
            num_match = re.match(r'^([\d,\s]+)\.\s*$', text)
            if num_match:
                # Save previous question if exists
                if current_question_parts and current_question_nums:
                    full_question = join_hyphenated_lines(current_question_parts)
                    grouped_lines.append(('question', current_question_nums, full_question))

                # Start new question
                numbers_str = num_match.group(1)
                current_question_nums = [int(n.strip()) for n in numbers_str.split(',') if n.strip().isdigit()]
                current_question_parts = []
            elif current_question_nums is not None:
                # Continue current question
                current_question_parts.append(text)
            else:
                # Question line without number prefix - could be continuation or standalone
                # Check if it's a question (contains ?)
                if '?' in text:
                    grouped_lines.append(('question_text', None, text))
                else:
                    grouped_lines.append(('other', font_size, text))
        else:
            # Not a question line - save any pending question
            if current_question_parts and current_question_nums:
                full_question = ' '.join(current_question_parts)
                grouped_lines.append(('question', current_question_nums, full_question))
                current_question_parts = []
                current_question_nums = None

            grouped_lines.append(('text', font_size, text))

    # Save last question if exists
    if current_question_parts and current_question_nums:
        full_question = ' '.join(current_question_parts)
        grouped_lines.append(('question', current_question_nums, full_question))

    # Second pass: Build paragraphs and assign questions
    paragraphs_data = {}  # Dict: paragraph_number -> {text_lines, questions}
    current_para_num = None
    current_para_lines = []
    initial_para_lines = []  # Text before first numbered paragraph (paragraph 1)
    found_first_para_number = False
    final_questions = []
    final_questions_title = ""
    found_final_section = False  # True when we're after the horizontal line

    # Use horizontal line detection if available
    if horizontal_line_info and horizontal_line_info.get("found"):
        # We'll extract final questions separately using PDF position data
        final_questions, final_questions_title = extract_questions_after_horizontal_line(pdf_bytes, horizontal_line_info)
        # Mark that we should not collect more final questions during parsing
        skip_final_detection = len(final_questions) > 0
    else:
        skip_final_detection = False

    for item in grouped_lines:
        item_type = item[0]

        if item_type == 'question':
            para_nums, question_text = item[1], item[2]

            if found_final_section and not skip_final_detection:
                # Final questions (fallback if horizontal line detection didn't work)
                questions = extract_multiple_questions(question_text)
                for q in questions:
                    final_questions.append(create_question_info(q, QUESTION_ANSWER_TIME, True))
            elif para_nums:
                # Regular question - check if it spans multiple paragraphs
                if len(para_nums) > 1:
                    # Question spans multiple paragraphs (e.g., "1, 2.")
                    # Mark all these paragraphs as grouped together
                    for pn in para_nums:
                        if pn not in paragraphs_data:
                            paragraphs_data[pn] = {"text_lines": [], "questions": [], "grouped_with": para_nums.copy()}
                        else:
                            paragraphs_data[pn]["grouped_with"] = para_nums.copy()

                    # Assign question to the last paragraph in the group
                    target_para = para_nums[-1]
                else:
                    target_para = para_nums[0]

                questions = extract_multiple_questions(question_text)

                for q in questions:
                    if target_para not in paragraphs_data:
                        paragraphs_data[target_para] = {"text_lines": [], "questions": [], "grouped_with": []}
                    paragraphs_data[target_para]["questions"].append(create_question_info(q, QUESTION_ANSWER_TIME, False))

        elif item_type == 'question_text':
            # Question text without number (possibly final questions)
            question_text = item[2]
            if found_final_section and not skip_final_detection and '?' in question_text:
                questions = extract_multiple_questions(question_text)
                for q in questions:
                    final_questions.append(create_question_info(q, QUESTION_ANSWER_TIME, True))

        elif item_type == 'text':
            font_size, text = item[1], item[2]

            # Skip ornament symbols
            if text == '˛':
                continue

            # Check for "¿QUÉ RESPONDERÍA?" marker (fallback if horizontal line not found)
            text_upper = text.upper()
            if not skip_final_detection and ("QUÉ RESPONDERÍA" in text_upper or "QUE RESPONDERIA" in text_upper):
                found_final_section = True
                # Save current paragraph
                if current_para_num and current_para_lines:
                    if current_para_num not in paragraphs_data:
                        paragraphs_data[current_para_num] = {"text_lines": [], "questions": []}
                    paragraphs_data[current_para_num]["text_lines"].extend(current_para_lines)
                    current_para_lines = []
                continue

            # If we're after the final questions marker (fallback), collect final questions
            if found_final_section and not skip_final_detection:
                # Skip song references
                if text_upper.startswith("CANCIÓN") or text_upper.startswith("CANCION"):
                    continue
                # Questions contain "?"
                if '?' in text:
                    questions = extract_multiple_questions(text)
                    for q in questions:
                        final_questions.append(create_question_info(q, QUESTION_ANSWER_TIME, True))
                continue

            # Check if this is a paragraph number (size ~6.8, just a number)
            is_para_number = 6.0 <= font_size <= 7.5 and text.isdigit()
            is_paragraph_size = 10.5 <= font_size <= 11.5

            if is_para_number:
                # First numbered paragraph found - save initial text as paragraph 1
                if not found_first_para_number:
                    found_first_para_number = True
                    if initial_para_lines:
                        paragraphs_data[1] = {"text_lines": initial_para_lines.copy(), "questions": []}

                # Save previous paragraph
                if current_para_num and current_para_lines:
                    if current_para_num not in paragraphs_data:
                        paragraphs_data[current_para_num] = {"text_lines": [], "questions": []}
                    paragraphs_data[current_para_num]["text_lines"].extend(current_para_lines)

                current_para_num = int(text)
                current_para_lines = []

            elif is_paragraph_size:
                if current_para_num:
                    # Regular paragraph text
                    current_para_lines.append(text)
                elif not found_first_para_number:
                    # Text before first paragraph number - this is paragraph 1
                    initial_para_lines.append(text)

    # Save last paragraph
    if current_para_num and current_para_lines:
        if current_para_num not in paragraphs_data:
            paragraphs_data[current_para_num] = {"text_lines": [], "questions": [], "grouped_with": []}
        paragraphs_data[current_para_num]["text_lines"].extend(current_para_lines)

    # If no numbered paragraphs were found but we have initial text, create paragraph 1
    if not found_first_para_number and initial_para_lines:
        paragraphs_data[1] = {"text_lines": initial_para_lines, "questions": [], "grouped_with": []}

    # Build the analysis result
    analyzed_paragraphs = []
    total_words = 0
    total_questions = 0
    total_reading_time = 0.0
    total_question_time = 0.0
    cumulative_time = 0.0
    total_images = 0
    total_scriptures = 0
    total_notes = 0

    # Extra time for paragraphs with image, scripture or note references (40 seconds)
    EXTRA_CONTENT_TIME = 40

    # Sort paragraphs by number
    for para_num in sorted(paragraphs_data.keys()):
        para_data = paragraphs_data[para_num]
        para_text = ' '.join(para_data["text_lines"])
        questions = para_data["questions"]
        grouped_with = para_data.get("grouped_with", [])

        word_count = count_words(para_text)
        reading_time = calculate_reading_time(word_count)
        question_time = len(questions) * QUESTION_ANSWER_TIME

        # Count extra content and add time
        para_has_image = False
        para_has_scripture = False
        para_has_note = False

        # First, check questions for extra content
        for q in questions:
            if q.content_type == 'both':
                # Both image and scripture in the same parenthesis
                total_images += 1
                total_scriptures += 1
                para_has_image = True
                para_has_scripture = True
            elif q.content_type == 'image':
                total_images += 1
                para_has_image = True
            elif q.content_type == 'scripture':
                total_scriptures += 1
                para_has_scripture = True
            elif q.content_type == 'note':
                total_notes += 1
                para_has_note = True

        # Second, check for "lea" scripture references in the paragraph text itself
        lea_scriptures = extract_lea_scriptures_from_text(para_text)
        for lea_scripture in lea_scriptures:
            # Only count if not already counted from a question
            # Check if this scripture reference is already in one of the questions
            already_counted = False
            lea_content = lea_scripture["parenthesis_content"].lower()

            # Extract just the book and chapter:verse from the lea reference
            # e.g., "lea Marcos 3:1-6" -> "marcos 3:1-6"
            lea_scripture_ref = re.sub(r'^[Ll][EeÉé][Aa](?:lo|LO)?\s+', '', lea_content).strip()

            for q in questions:
                if q.parenthesis_content:
                    q_content = q.parenthesis_content.lower()
                    # Check if the scripture reference (without "lea") matches
                    if lea_scripture_ref in q_content or q_content in lea_scripture_ref:
                        already_counted = True
                        break
                    # Also check if it's the same reference with different format
                    # e.g., "Marcos 3:1-6" vs "lea Marcos 3:1-6"
                    q_scripture_ref = re.sub(r'^[Ll][EeÉé][Aa](?:lo|LO)?\s+', '', q_content).strip()
                    if lea_scripture_ref == q_scripture_ref:
                        already_counted = True
                        break

            if not already_counted:
                total_scriptures += 1
                para_has_scripture = True
                # Add as a virtual question to show in UI
                questions.append(QuestionInfo(
                    text="",  # No question text, just scripture reference
                    answer_time=0,
                    is_final_question=False,
                    parenthesis_content=lea_scripture["parenthesis_content"],
                    content_type="scripture"
                ))

        # Add 40 seconds for each type of extra content
        extra_time = 0
        if para_has_image:
            extra_time += EXTRA_CONTENT_TIME
        if para_has_scripture:
            extra_time += EXTRA_CONTENT_TIME
        if para_has_note:
            extra_time += EXTRA_CONTENT_TIME

        reading_time += extra_time

        total_words += word_count
        total_questions += len(questions)
        total_reading_time += reading_time
        total_question_time += question_time
        cumulative_time += reading_time + question_time

        analyzed_paragraphs.append(ParagraphAnalysis(
            number=para_num,
            text=para_text,
            word_count=word_count,
            reading_time_seconds=round(reading_time, 2),
            questions=questions,
            total_time_seconds=round(reading_time + question_time, 2),
            cumulative_time_seconds=round(cumulative_time, 2),
            grouped_with=grouped_with
        ))

    # Add final questions
    final_questions_start_time = cumulative_time
    final_questions_time = len(final_questions) * QUESTION_ANSWER_TIME
    total_questions += len(final_questions)
    total_question_time += final_questions_time

    # Count extra content in final questions
    for q in final_questions:
        if q.content_type == 'both':
            total_images += 1
            total_scriptures += 1
        elif q.content_type == 'image':
            total_images += 1
        elif q.content_type == 'scripture':
            total_scriptures += 1

    # Calculate paragraph questions (total - final)
    total_paragraph_questions = total_questions - len(final_questions)

    FIXED_TOTAL_TIME = 3600  # 60 minutes

    return PDFAnalysisResult(
        filename=filename,
        total_words=total_words,
        total_paragraphs=len(analyzed_paragraphs),
        total_questions=total_questions,
        total_reading_time_seconds=round(total_reading_time, 2),
        total_question_time_seconds=round(total_question_time, 2),
        total_time_seconds=FIXED_TOTAL_TIME,
        fixed_duration=True,
        final_questions_start_time=round(final_questions_start_time, 2),
        final_questions=final_questions,
        final_questions_title=final_questions_title,
        paragraphs=analyzed_paragraphs,
        total_paragraph_questions=total_paragraph_questions,
        total_review_questions=len(final_questions),
        total_images=total_images,
        total_scriptures=total_scriptures,
        total_notes=total_notes
    )


def analyze_pdf_with_font_info_configurable(
        pdf_bytes: bytes,
        filename: str,
        wpm: int = WORDS_PER_MINUTE,
        answer_time: int = QUESTION_ANSWER_TIME
) -> PDFAnalysisResult:
    """
    Analyze PDF using font size information with configurable reading speed and answer time.
    """
    lines = extract_text_with_sizes(pdf_bytes)

    if not lines:
        text = extract_text_from_pdf(pdf_bytes)
        return analyze_pdf_content_configurable(text, filename, wpm, answer_time)

    # Detect horizontal line position for final questions section
    horizontal_line_info = detect_horizontal_line_separator(pdf_bytes)

    # Identify font sizes used in document
    size_counts = {}
    for line in lines:
        size_key = round(line.font_size, 1)
        size_counts[size_key] = size_counts.get(size_key, 0) + 1

    if not size_counts:
        text = extract_text_from_pdf(pdf_bytes)
        return analyze_pdf_content_configurable(text, filename, wpm, answer_time)

    # First pass: Group consecutive question lines (size ~9.0)
    grouped_lines = []
    current_question_parts = []
    current_question_nums = None

    for line in lines:
        text = line.text.strip()
        font_size = round(line.font_size, 1)

        if not text:
            continue

        is_question_size = 8.5 <= font_size <= 9.5

        if is_question_size:
            num_match = re.match(r'^([\d,\s]+)\.\s*$', text)
            if num_match:
                if current_question_parts and current_question_nums:
                    full_question = join_hyphenated_lines(current_question_parts)
                    grouped_lines.append(('question', current_question_nums, full_question))

                numbers_str = num_match.group(1)
                current_question_nums = [int(n.strip()) for n in numbers_str.split(',') if n.strip().isdigit()]
                current_question_parts = []
            elif current_question_nums is not None:
                current_question_parts.append(text)
            else:
                if '?' in text:
                    grouped_lines.append(('question_text', None, text))
                else:
                    grouped_lines.append(('other', font_size, text))
        else:
            if current_question_parts and current_question_nums:
                full_question = ' '.join(current_question_parts)
                grouped_lines.append(('question', current_question_nums, full_question))
                current_question_parts = []
                current_question_nums = None

            grouped_lines.append(('text', font_size, text))

    if current_question_parts and current_question_nums:
        full_question = ' '.join(current_question_parts)
        grouped_lines.append(('question', current_question_nums, full_question))

    # Second pass: Build paragraphs and assign questions
    paragraphs_data = {}
    current_para_num = None
    current_para_lines = []
    initial_para_lines = []
    found_first_para_number = False
    final_questions = []
    final_questions_title = ""
    found_final_section = False

    if horizontal_line_info and horizontal_line_info.get("found"):
        final_questions_raw, final_questions_title = extract_questions_after_horizontal_line(pdf_bytes, horizontal_line_info)
        # Update answer_time for final questions with configurable value - preserve parenthesis info
        final_questions = [
            QuestionInfo(
                text=q.text,
                answer_time=answer_time,
                is_final_question=True,
                parenthesis_content=q.parenthesis_content,
                content_type=q.content_type
            )
            for q in final_questions_raw
        ]
        skip_final_detection = len(final_questions) > 0
    else:
        skip_final_detection = False

    for item in grouped_lines:
        item_type = item[0]

        if item_type == 'question':
            para_nums, question_text = item[1], item[2]

            if found_final_section and not skip_final_detection:
                questions = extract_multiple_questions(question_text)
                for q in questions:
                    final_questions.append(create_question_info(q, answer_time, True))
            elif para_nums:
                # Regular question - check if it spans multiple paragraphs
                if len(para_nums) > 1:
                    # Question spans multiple paragraphs (e.g., "1, 2.")
                    for pn in para_nums:
                        if pn not in paragraphs_data:
                            paragraphs_data[pn] = {"text_lines": [], "questions": [], "grouped_with": para_nums.copy()}
                        else:
                            paragraphs_data[pn]["grouped_with"] = para_nums.copy()
                    target_para = para_nums[-1]
                else:
                    target_para = para_nums[0]

                questions = extract_multiple_questions(question_text)

                for q in questions:
                    if target_para not in paragraphs_data:
                        paragraphs_data[target_para] = {"text_lines": [], "questions": [], "grouped_with": []}
                    paragraphs_data[target_para]["questions"].append(create_question_info(q, answer_time, False))

        elif item_type == 'question_text':
            question_text = item[2]
            if found_final_section and not skip_final_detection and '?' in question_text:
                questions = extract_multiple_questions(question_text)
                for q in questions:
                    final_questions.append(create_question_info(q, answer_time, True))

        elif item_type == 'text':
            font_size, text = item[1], item[2]

            if text == '˛':
                continue

            text_upper = text.upper()
            if not skip_final_detection and ("QUÉ RESPONDERÍA" in text_upper or "QUE RESPONDERIA" in text_upper):
                found_final_section = True
                if current_para_num and current_para_lines:
                    if current_para_num not in paragraphs_data:
                        paragraphs_data[current_para_num] = {"text_lines": [], "questions": []}
                    paragraphs_data[current_para_num]["text_lines"].extend(current_para_lines)
                    current_para_lines = []
                continue

            if found_final_section and not skip_final_detection:
                if text_upper.startswith("CANCIÓN") or text_upper.startswith("CANCION"):
                    continue
                if '?' in text:
                    questions = extract_multiple_questions(text)
                    for q in questions:
                        final_questions.append(create_question_info(q, answer_time, True))
                continue

            is_para_number = 6.0 <= font_size <= 7.5 and text.isdigit()
            is_paragraph_size = 10.5 <= font_size <= 11.5

            if is_para_number:
                if not found_first_para_number:
                    found_first_para_number = True
                    if initial_para_lines:
                        paragraphs_data[1] = {"text_lines": initial_para_lines.copy(), "questions": [], "grouped_with": []}

                if current_para_num and current_para_lines:
                    if current_para_num not in paragraphs_data:
                        paragraphs_data[current_para_num] = {"text_lines": [], "questions": [], "grouped_with": []}
                    paragraphs_data[current_para_num]["text_lines"].extend(current_para_lines)

                current_para_num = int(text)
                current_para_lines = []

            elif is_paragraph_size:
                if current_para_num:
                    current_para_lines.append(text)
                elif not found_first_para_number:
                    initial_para_lines.append(text)

    if current_para_num and current_para_lines:
        if current_para_num not in paragraphs_data:
            paragraphs_data[current_para_num] = {"text_lines": [], "questions": [], "grouped_with": []}
        paragraphs_data[current_para_num]["text_lines"].extend(current_para_lines)

    if not found_first_para_number and initial_para_lines:
        paragraphs_data[1] = {"text_lines": initial_para_lines, "questions": [], "grouped_with": []}

    # Build the analysis result with configurable times
    analyzed_paragraphs = []
    total_words = 0
    total_questions = 0
    total_reading_time = 0.0
    total_question_time = 0.0
    cumulative_time = 0.0
    total_images = 0
    total_scriptures = 0
    total_notes = 0

    # Extra time for paragraphs with image or scripture references (40 seconds)
    EXTRA_CONTENT_TIME = 40

    for para_num in sorted(paragraphs_data.keys()):
        para_data = paragraphs_data[para_num]
        para_text = ' '.join(para_data["text_lines"])
        questions = para_data["questions"]
        grouped_with = para_data.get("grouped_with", [])

        word_count = count_words(para_text)
        reading_time = calculate_reading_time(word_count, wpm)
        question_time = len(questions) * answer_time

        # Count extra content and add time
        para_has_image = False
        para_has_scripture = False
        para_has_note = False

        # First, check questions for extra content
        for q in questions:
            if q.content_type == 'both':
                # Both image and scripture in the same parenthesis
                total_images += 1
                total_scriptures += 1
                para_has_image = True
                para_has_scripture = True
            elif q.content_type == 'image':
                total_images += 1
                para_has_image = True
            elif q.content_type == 'scripture':
                total_scriptures += 1
                para_has_scripture = True
            elif q.content_type == 'note':
                total_notes += 1
                para_has_note = True

        # Second, check for "lea" scripture references in the paragraph text itself
        lea_scriptures = extract_lea_scriptures_from_text(para_text)
        for lea_scripture in lea_scriptures:
            # Only count if not already counted from a question
            # Check if this scripture reference is already in one of the questions
            already_counted = False
            lea_content = lea_scripture["parenthesis_content"].lower()

            # Extract just the book and chapter:verse from the lea reference
            # e.g., "lea Marcos 3:1-6" -> "marcos 3:1-6"
            lea_scripture_ref = re.sub(r'^[Ll][EeÉé][Aa](?:lo|LO)?\s+', '', lea_content).strip()

            for q in questions:
                if q.parenthesis_content:
                    q_content = q.parenthesis_content.lower()
                    # Check if the scripture reference (without "lea") matches
                    if lea_scripture_ref in q_content or q_content in lea_scripture_ref:
                        already_counted = True
                        break
                    # Also check if it's the same reference with different format
                    # e.g., "Marcos 3:1-6" vs "lea Marcos 3:1-6"
                    q_scripture_ref = re.sub(r'^[Ll][EeÉé][Aa](?:lo|LO)?\s+', '', q_content).strip()
                    if lea_scripture_ref == q_scripture_ref:
                        already_counted = True
                        break

            if not already_counted:
                total_scriptures += 1
                para_has_scripture = True
                # Add as a virtual question to show in UI
                questions.append(QuestionInfo(
                    text="",  # No question text, just scripture reference
                    answer_time=0,
                    is_final_question=False,
                    parenthesis_content=lea_scripture["parenthesis_content"],
                    content_type="scripture"
                ))

        # Add 40 seconds for each type of extra content
        extra_time = 0
        if para_has_image:
            extra_time += EXTRA_CONTENT_TIME
        if para_has_scripture:
            extra_time += EXTRA_CONTENT_TIME
        if para_has_note:
            extra_time += EXTRA_CONTENT_TIME

        reading_time += extra_time

        total_words += word_count
        total_questions += len(questions)
        total_reading_time += reading_time
        total_question_time += question_time
        cumulative_time += reading_time + question_time

        analyzed_paragraphs.append(ParagraphAnalysis(
            number=para_num,
            text=para_text,
            word_count=word_count,
            reading_time_seconds=round(reading_time, 2),
            questions=questions,
            total_time_seconds=round(reading_time + question_time, 2),
            cumulative_time_seconds=round(cumulative_time, 2),
            grouped_with=grouped_with
        ))

    # Count extra content in final questions
    for q in final_questions:
        if q.content_type == 'both':
            total_images += 1
            total_scriptures += 1
        elif q.content_type == 'image':
            total_images += 1
        elif q.content_type == 'scripture':
            total_scriptures += 1
        elif q.content_type == 'note':
            total_notes += 1

    # Calculate paragraph questions (total - final)
    total_paragraph_questions = total_questions - len(final_questions)

    final_questions_start_time = cumulative_time
    final_questions_time = len(final_questions) * answer_time
    total_questions += len(final_questions)
    total_question_time += final_questions_time

    FIXED_TOTAL_TIME = 3600

    return PDFAnalysisResult(
        filename=filename,
        total_words=total_words,
        total_paragraphs=len(analyzed_paragraphs),
        total_questions=total_questions,
        total_reading_time_seconds=round(total_reading_time, 2),
        total_question_time_seconds=round(total_question_time, 2),
        total_time_seconds=FIXED_TOTAL_TIME,
        fixed_duration=True,
        final_questions_start_time=round(final_questions_start_time, 2),
        final_questions=final_questions,
        final_questions_title=final_questions_title,
        paragraphs=analyzed_paragraphs,
        total_paragraph_questions=total_paragraph_questions,
        total_review_questions=len(final_questions),
        total_images=total_images,
        total_scriptures=total_scriptures,
        total_notes=total_notes
    )


def parse_question_line_watchtower(text: str) -> tuple:
    """
    Parse a Watchtower-style question line.

    Formats:
    - "1, 2. ¿En qué situación...?" -> ([1, 2], ["¿En qué situación...?"])
    - "5. ¿Qué consiguieron...?" -> ([5], ["¿Qué consiguieron...?"])
    - "14, 15. ¿Cómo puede...?" -> ([14, 15], ["¿Cómo puede...?"])
    - "3. ¿Primera? ¿Segunda?" -> ([3], ["¿Primera?", "¿Segunda?"])

    Returns: (list of paragraph numbers, list of question texts)
    """
    # Pattern: one or more numbers separated by commas, followed by period
    match = re.match(r'^([\d,\s]+)\.\s*(.+)$', text)

    if not match:
        return ([], [])

    # Extract paragraph numbers
    numbers_str = match.group(1)
    numbers = []
    for n in numbers_str.split(','):
        n = n.strip()
        if n.isdigit():
            numbers.append(int(n))

    if not numbers:
        return ([], [])

    # Extract question text(s)
    questions_text = match.group(2).strip()

    if not questions_text:
        return (numbers, [])

    # Extract multiple questions from the text
    questions = extract_multiple_questions(questions_text)

    return (numbers, questions)


def extract_multiple_questions(text: str) -> list:
    """
    Extract multiple questions from a single text line.
    Handles sentences with and without question marks.

    Examples:
    - "¿Primera pregunta? ¿Segunda pregunta?" -> ["¿Primera pregunta?", "¿Segunda pregunta?"]
    - "¿Única pregunta?" -> ["¿Única pregunta?"]
    - "¿Pregunta? (Vea imagen)" -> ["¿Pregunta? (Vea imagen)"]
    - "Explique con un ejemplo..." -> ["Explique con un ejemplo..."]
    """
    if not text.strip():
        return []

    # If the text does not contain a question mark, treat the whole line as one question.
    if '?' not in text:
        return [text.strip()]

    questions = []

    # Pattern to match questions with optional parenthetical content after them
    # Matches: ¿...? or ...? optionally followed by (...)
    parts = re.findall(r'¿[^?]+\?\s*(?:\([^)]+\))?|[^?¿]+\?\s*(?:\([^)]+\))?', text)

    for part in parts:
        part = part.strip()
        if part and len(part) > 3:
            questions.append(part)

    # If regex didn't find anything but there's a '?', it might be a malformed question.
    # As a fallback, just return the whole text.
    if not questions and '?' in text:
        questions.append(text.strip())

    return questions


def analyze_pdf_content(text: str, filename: str) -> PDFAnalysisResult:
    """Analyze PDF content and return structured analysis"""
    paragraphs = split_into_paragraphs(text)

    # Extract final questions (those after "¿QUÉ RESPONDERÍAS?")
    final_questions = extract_final_questions(text)
    final_questions_title = ""  # Default empty title for text-only analysis

    # Check if text contains "¿QUÉ RESPONDERÍAS?"
    text_lower = text.lower()
    has_que_responderias = "qué responderías" in text_lower or "que responderias" in text_lower

    # Find the paragraph that contains "¿QUÉ RESPONDERÍAS?"
    que_responderias_paragraph = -1
    if has_que_responderias:
        for idx, para in enumerate(paragraphs):
            para_lower = para.lower()
            if "qué responderías" in para_lower or "que responderias" in para_lower:
                que_responderias_paragraph = idx
                break

    analyzed_paragraphs = []
    total_words = 0
    total_questions = 0
    total_reading_time = 0.0
    total_question_time = 0.0
    cumulative_time = 0.0
    final_questions_start_time = 0.0

    for i, para_text in enumerate(paragraphs, 1):
        # Skip paragraphs that are after "¿QUÉ RESPONDERÍAS?" (final questions section)
        if que_responderias_paragraph >= 0 and (i - 1) > que_responderias_paragraph:
            continue

        word_count = count_words(para_text)
        reading_time = calculate_reading_time(word_count)

        # Detect questions for this paragraph
        questions = detect_questions(para_text, i, False)
        question_time = len(questions) * QUESTION_ANSWER_TIME

        total_words += word_count
        total_questions += len(questions)
        total_reading_time += reading_time
        total_question_time += question_time

        # Calculate cumulative time
        cumulative_time += reading_time + question_time

        analyzed_paragraphs.append(ParagraphAnalysis(
            number=i,
            text=para_text,
            word_count=word_count,
            reading_time_seconds=round(reading_time, 2),
            questions=questions,
            total_time_seconds=round(reading_time + question_time, 2),
            cumulative_time_seconds=round(cumulative_time, 2)
        ))

    # Calculate when final questions start (after all paragraphs)
    final_questions_start_time = cumulative_time

    # Add final questions time to totals
    final_questions_time = len(final_questions) * QUESTION_ANSWER_TIME
    total_questions += len(final_questions)
    total_question_time += final_questions_time

    # Total time is ALWAYS 60 minutes (3600 seconds)
    FIXED_TOTAL_TIME = 3600  # 60 minutes in seconds

    return PDFAnalysisResult(
        filename=filename,
        total_words=total_words,
        total_paragraphs=len(analyzed_paragraphs),
        total_questions=total_questions,
        total_reading_time_seconds=round(total_reading_time, 2),
        total_question_time_seconds=round(total_question_time, 2),
        total_time_seconds=FIXED_TOTAL_TIME,
        fixed_duration=True,
        final_questions_start_time=round(final_questions_start_time, 2),
        final_questions=final_questions,
        final_questions_title=final_questions_title,
        paragraphs=analyzed_paragraphs,
        total_paragraph_questions=total_questions - len(final_questions),
        total_review_questions=len(final_questions),
        total_images=0,
        total_scriptures=0,
        total_notes=0
    )


def analyze_pdf_content_configurable(
        text: str,
        filename: str,
        wpm: int = WORDS_PER_MINUTE,
        answer_time: int = QUESTION_ANSWER_TIME
) -> PDFAnalysisResult:
    """Analyze PDF content with configurable reading speed and answer time"""
    paragraphs = split_into_paragraphs(text)

    # Extract final questions (those after "¿QUÉ RESPONDERÍAS?")
    final_questions_raw = extract_final_questions(text)
    # Update answer_time for final questions - preserve parenthesis info
    final_questions = [
        QuestionInfo(
            text=q.text,
            answer_time=answer_time,
            is_final_question=True,
            parenthesis_content=q.parenthesis_content,
            content_type=q.content_type
        )
        for q in final_questions_raw
    ]
    final_questions_title = ""

    text_lower = text.lower()
    has_que_responderias = "qué responderías" in text_lower or "que responderias" in text_lower

    que_responderias_paragraph = -1
    if has_que_responderias:
        for idx, para in enumerate(paragraphs):
            para_lower = para.lower()
            if "qué responderías" in para_lower or "que responderias" in para_lower:
                que_responderias_paragraph = idx
                break

    analyzed_paragraphs = []
    total_words = 0
    total_questions = 0
    total_reading_time = 0.0
    total_question_time = 0.0
    cumulative_time = 0.0
    final_questions_start_time = 0.0

    for i, para_text in enumerate(paragraphs, 1):
        if que_responderias_paragraph >= 0 and (i - 1) > que_responderias_paragraph:
            continue

        word_count = count_words(para_text)
        reading_time = calculate_reading_time(word_count, wpm)

        questions_raw = detect_questions(para_text, i, False)
        # Update answer_time for questions - preserve parenthesis info
        questions = [
            QuestionInfo(
                text=q.text,
                answer_time=answer_time,
                is_final_question=False,
                parenthesis_content=q.parenthesis_content,
                content_type=q.content_type
            )
            for q in questions_raw
        ]
        question_time = len(questions) * answer_time

        total_words += word_count
        total_questions += len(questions)
        total_reading_time += reading_time
        total_question_time += question_time
        cumulative_time += reading_time + question_time

        analyzed_paragraphs.append(ParagraphAnalysis(
            number=i,
            text=para_text,
            word_count=word_count,
            reading_time_seconds=round(reading_time, 2),
            questions=questions,
            total_time_seconds=round(reading_time + question_time, 2),
            cumulative_time_seconds=round(cumulative_time, 2)
        ))

    final_questions_start_time = cumulative_time
    final_questions_time = len(final_questions) * answer_time
    total_questions += len(final_questions)
    total_question_time += final_questions_time

    FIXED_TOTAL_TIME = 3600

    return PDFAnalysisResult(
        filename=filename,
        total_words=total_words,
        total_paragraphs=len(analyzed_paragraphs),
        total_questions=total_questions,
        total_reading_time_seconds=round(total_reading_time, 2),
        total_question_time_seconds=round(total_question_time, 2),
        total_time_seconds=FIXED_TOTAL_TIME,
        fixed_duration=True,
        final_questions_start_time=round(final_questions_start_time, 2),
        final_questions=final_questions,
        final_questions_title=final_questions_title,
        paragraphs=analyzed_paragraphs,
        total_paragraph_questions=total_questions - len(final_questions),
        total_review_questions=len(final_questions),
        total_images=0,
        total_scriptures=0,
        total_notes=0
    )


# Routes
@api_router.get("/")
async def root():
    return {"message": "PDF Reading Timer API"}


@api_router.post("/analyze-pdf", response_model=PDFAnalysisResult)
async def analyze_pdf(
        file: UploadFile = File(...),
        wpm: int = WORDS_PER_MINUTE,
        answer_time_seconds: int = QUESTION_ANSWER_TIME
):
    """Upload and analyze a PDF file for reading time

    Args:
        file: PDF file to analyze
        wpm: Words per minute for reading speed (default: 180)
        answer_time_seconds: Seconds allocated for each question answer (default: 35)
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    # Validate parameters
    if wpm < 100 or wpm > 300:
        raise HTTPException(status_code=400, detail="WPM debe estar entre 100 y 300")
    if answer_time_seconds < 10 or answer_time_seconds > 120:
        raise HTTPException(status_code=400, detail="El tiempo de respuesta debe estar entre 10 y 120 segundos")

    try:
        pdf_bytes = await file.read()

        # Try to analyze with font size information first
        try:
            result = analyze_pdf_with_font_info_configurable(pdf_bytes, file.filename, wpm, answer_time_seconds)
        except Exception as font_error:
            logging.warning(f"Font analysis failed, falling back to text-only: {font_error}")
            text = extract_text_from_pdf(pdf_bytes)
            if not text.strip():
                raise HTTPException(status_code=400, detail="No se pudo extraer texto del PDF")
            result = analyze_pdf_content_configurable(text, file.filename, wpm, answer_time_seconds)

        # Save to database (if available)
        if db is not None:
            try:
                doc = result.model_dump()
                doc['timestamp'] = doc['timestamp'].isoformat()
                doc['settings'] = {'wpm': wpm, 'answer_time_seconds': answer_time_seconds}
                await db.pdf_analyses.insert_one(doc)
            except Exception as db_error:
                logger.warning(f"Failed to save analysis to database: {db_error}")

        return result

    except Exception as e:
        logging.error(f"Error analyzing PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al procesar el PDF: {str(e)}")


@api_router.get("/analyses", response_model=List[PDFAnalysisResult])
async def get_analyses():
    """Get all PDF analyses"""
    if db is None:
        return []
    try:
        analyses = await db.pdf_analyses.find(
            {},
            {"_id": 0}
        ).sort("timestamp", -1).to_list(50)
        for analysis in analyses:
            if isinstance(analysis.get('timestamp'), str):
                analysis['timestamp'] = datetime.fromisoformat(analysis['timestamp'])
        return analyses
    except Exception as e:
        logger.warning(f"Failed to get analyses: {e}")
        return []


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    if db is not None:
        try:
            doc = status_obj.model_dump()
            doc['timestamp'] = doc['timestamp'].isoformat()
            await db.status_checks.insert_one(doc)
        except Exception as e:
            logger.warning(f"Failed to save status check: {e}")
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    if db is None:
        return []
    try:
        status_checks = await db.status_checks.find(
            {},
            {"_id": 0}
        ).sort("timestamp", -1).to_list(100)
        for check in status_checks:
            if isinstance(check['timestamp'], str):
                check['timestamp'] = datetime.fromisoformat(check['timestamp'])
        return status_checks
    except Exception as e:
        logger.warning(f"Failed to get status checks: {e}")
        return []


# Health check endpoint for Kubernetes/deployment
@api_router.get("/health")
async def health_check():
    """Health check endpoint for deployment"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

