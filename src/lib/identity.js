// Une la respuesta del RPC con la identidad local sin perder campos que el
// servidor no devuelve (por ejemplo, el país antes de la migración 0021).
export const toIdentity = (data, previous = null) => ({
  ...(previous || {}),
  username: data.username ?? previous?.username,
  token: data.token ?? previous?.token,
  avatar_key: data.avatar_key || previous?.avatar_key || 'inicial',
  frame_key: data.frame_key || previous?.frame_key || 'inicial',
  // `null` explícito significa "sin bandera"; ausente significa "no lo sé".
  country: Object.prototype.hasOwnProperty.call(data, 'country')
    ? data.country
    : (previous?.country ?? null),
  day_streak: data.day_streak ?? previous?.day_streak ?? 0,
  best_day_streak: data.best_day_streak ?? previous?.best_day_streak ?? 0,
  last_played_on: data.last_played_on ?? previous?.last_played_on ?? null
});
