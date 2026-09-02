-- Se retira la integración con Google Calendar.
--
-- El calendario de eventos dentro de TimeDesk se queda; lo que se va es la
-- sincronización. Motivo: para una app de 2-4 personas, el flujo de Google
-- pedía demasiado a cambio de poco — pantalla de consentimiento con testers
-- aprobados uno a uno, aviso permanente de "app no verificada", y refresh
-- tokens que caducan cada 7 días mientras el proyecto siga en modo Testing.
--
-- La migración `google_calendar` (20260901140000) ya estaba aplicada, así que
-- NO se borra su archivo: el historial de migraciones es de solo añadir. Esta
-- deshace lo que aquella creó.
--
-- No hay datos que perder: la conexión nunca llegó a completarse (Google
-- bloqueó la autorización antes de emitir ningún token), así que la tabla está
-- vacía. Aun así, si alguien hubiera conectado su cuenta, conviene saber que
-- esto borra su refresh token — que es lo correcto al quitar la integración,
-- pero no se puede deshacer.

drop function if exists public.save_google_account(text, text, timestamptz, text);
drop table if exists public.google_calendar_accounts;
