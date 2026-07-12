type CredentialHandler = (credential: string) => void;

type GsiButtonOptions = {
  type?: string;
  theme?: string;
  size?: string;
  text?: string;
  shape?: string;
  width?: number;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: GsiButtonOptions) => void;
          cancel: () => void;
        };
      };
    };
  }
}

let initializedClientId: string | null = null;
let credentialHandler: CredentialHandler | null = null;
let gsiScriptPromise: Promise<void> | null = null;

function handleGsiCredential(response: { credential?: string }) {
  if (response.credential && credentialHandler) {
    credentialHandler(response.credential);
  }
}

/** Load Google Identity Services script once. */
export function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="accounts.google.com/gsi/client"]'
    );
    if (existing) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GSI script failed')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GSI script failed'));
    document.body.appendChild(script);
  });

  return gsiScriptPromise;
}

/** Register the active button callback — only one Google button is shown at a time. */
export function setGsiCredentialHandler(handler: CredentialHandler | null) {
  credentialHandler = handler;
}

/** Initialize Google Identity Services once per client id. */
export function ensureGsiInitialized(clientId: string): boolean {
  const gsi = window.google?.accounts?.id;
  if (!gsi) return false;

  if (initializedClientId !== clientId) {
    gsi.initialize({
      client_id: clientId,
      callback: handleGsiCredential,
    });
    initializedClientId = clientId;
  }

  return true;
}

export function renderGsiButton(
  container: HTMLElement,
  options: GsiButtonOptions
): boolean {
  const gsi = window.google?.accounts?.id;
  if (!gsi) return false;

  container.replaceChildren();
  gsi.renderButton(container, options);
  return true;
}

export function currentOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}
