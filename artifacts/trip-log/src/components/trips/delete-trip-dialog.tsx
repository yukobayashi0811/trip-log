import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { useDeleteTrip, getGetTripQueryKey, getListTripsQueryKey } from '@workspace/api-client-react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { apiErrorInfo, errorStatus } from '@/lib/trips';

export function DeleteTripDialog({ tripId, title }: { tripId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const del = useDeleteTrip();

  const finish = () => {
    qc.removeQueries({ queryKey: getGetTripQueryKey(tripId) });
    qc.invalidateQueries({ queryKey: getListTripsQueryKey() });
    setOpen(false);
    setLocation('/trips', { replace: true });
  };

  const confirm = () => {
    if (del.isPending) return;
    setError(null);
    del.mutate({ id: tripId }, {
      onSuccess: finish,
      onError: (err) => {
        if (errorStatus(err) === 404) { finish(); return; }
        setError(apiErrorInfo(err).message.replace('saving', 'deleting'));
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!del.isPending) { setOpen(o); if (!o) setError(null); } }}>
      <AlertDialogTrigger asChild>
        <button type="button" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10" data-testid="button-delete-trip">
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl border-card-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl font-normal">Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            This permanently deletes the trip and everything recorded inside it. It can't be undone or recovered.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" data-testid="text-delete-error">{error}</p>}
        <AlertDialogFooter className="gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={del.isPending} className="inline-flex justify-center rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-background disabled:opacity-60" data-testid="button-cancel-delete">Cancel</button>
          <button type="button" onClick={confirm} disabled={del.isPending} className="inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-70" data-testid="button-confirm-delete">
            {del.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {del.isPending ? 'Deleting…' : 'Delete trip'}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
