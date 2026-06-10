export function serializeItineraryEntity(
  entity: {
    name: string;
    type: string;
    description: string | null;
    media: unknown;
  } | null
) {
  if (!entity) return null;
  return {
    name: entity.name,
    type: entity.type,
    description: entity.description,
    media: entity.media,
  };
}
