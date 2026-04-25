import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

// This file is used ONLY for web static export (production web build).
// It customises the root <html> document to inject the PWA manifest,
// theme-color, and a small service-worker registration snippet.
// Native (iOS / Android) builds ignore this file completely.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="application-name" content="DocVault" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="DocVault" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#1A73E8" />
        <meta name="msapplication-navbutton-color" content="#1A73E8" />
        <meta
          name="description"
          content="DocVault — Organised PDF storage for your team. Monthly Returns, Forwarding Letters, IFA Reports."
        />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />
        <link rel="icon" href="/assets/images/favicon.png" type="image/png" />

        <title>DocVault</title>

        {/* Service-worker registration — gives the browser a PWA "Install" affordance */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker
                    .register('/service-worker.js')
                    .catch(function (err) {
                      console.warn('SW registration failed:', err);
                    });
                });
              }
            `,
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
