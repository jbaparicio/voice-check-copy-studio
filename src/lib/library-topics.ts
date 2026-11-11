export interface TopicPiece {
  id: string;
  request_id: string | null;
  created_at: string;
  channel: string;
  status: string;
  content_requests: { brief: string; created_at?: string } | null;
}

/** Request identity, not matching prose, defines a generation session. */
export function groupTopics<T extends TopicPiece>(pieces: T[]) {
  const groups = new Map<string, { id: string; requestId: string | null; title: string; date: string; pieces: T[] }>();
  for (const piece of pieces) {
    const id = piece.request_id ?? piece.id;
    let topic = groups.get(id);
    if (!topic) {
      topic = {
        id, requestId: piece.request_id,
        title: piece.content_requests?.brief.trim().split(/\r?\n/)[0]?.trim() || "Untitled topic",
        date: piece.content_requests?.created_at ?? piece.created_at, pieces: [],
      };
      groups.set(id, topic);
    }
    topic.pieces.push(piece);
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function canDeleteContent(roles: string[] | undefined, isOwner = false) {
  return isOwner || Boolean(roles?.includes("admin"));
}