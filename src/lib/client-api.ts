/** Typed fetch helpers for client components. */

export async function addFavorite(newsItemId: number) {
  const res = await fetch(`/api/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newsItemId }),
  });
  if (!res.ok) throw new Error("Failed to add favorite");
  return res.json();
}

export async function removeFavorite(newsItemId: number) {
  const res = await fetch(`/api/favorites/${newsItemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove favorite");
  return res.json();
}
