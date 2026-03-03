import { useEffect } from 'react';
import { toast } from 'sonner';

export const useUpdateNotifier = () => {
  useEffect(() => {
    // No ejecutar en desarrollo, puede interferir con Hot-Reloading
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) {
          // Escucha si se encuentra una nueva versión del service worker
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                // Si el nuevo worker se ha instalado y hay uno viejo controlando la página...
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // ¡Nueva versión disponible! Mostramos una notificación.
                  toast.info('Hay una nueva versión disponible.', {
                    action: {
                      label: 'Actualizar ahora',
                      onClick: () => {
                        // Le decimos al nuevo worker que se active
                        installingWorker.postMessage({ type: 'SKIP_WAITING' });
                      },
                    },
                    duration: Infinity, // La notificación no se cierra sola
                  });
                }
              };
            }
          };

          // Una vez que el nuevo worker toma el control, recargamos la página.
          let refreshing;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
          });
        }
      });
    }
  }, []);
};