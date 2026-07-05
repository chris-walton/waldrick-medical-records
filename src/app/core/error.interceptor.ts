import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

/**
 * Surfaces API errors as a snackbar so failures are visible instead of silent.
 * 403s (Cloudflare Access rejected the request) get a clearer message.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackbar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      let message = 'Something went wrong.';
      if (err.status === 0) {
        message = 'Cannot reach the server. Is the API running?';
      } else if (err.status === 403) {
        message = 'Not authorized. Your Cloudflare Access session may have expired.';
      } else if (typeof err.error?.error === 'string') {
        message = err.error.error;
      } else if (err.message) {
        message = err.message;
      }

      // Don't nag on background identity checks.
      if (!req.url.endsWith('/api/me')) {
        snackbar.open(message, 'Dismiss', { duration: 6000 });
      }
      return throwError(() => err);
    }),
  );
};
