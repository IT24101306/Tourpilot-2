import { ApiError } from "./client";

export async function uploadImage(file: File, token: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(
      (errBody as { error?: string }).error || res.statusText,
      res.status
    );
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}
