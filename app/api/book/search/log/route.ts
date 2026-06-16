import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordSearchEvent } from "@/lib/search-event.server";
import { NextResponse } from "next/server";

type SearchLogBody = {
  query?: unknown;
  selectedTags?: unknown;
  resultTagIds?: unknown;
};

function getTopTagIds(tagIds: string[], limit: number) {
  const counts = new Map<string, number>();

  for (const tagId of tagIds) {
    counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tagId]) => tagId);
}

export async function POST(request: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: "認証できない" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SearchLogBody;
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const selectedTags = Array.isArray(body.selectedTags)
      ? body.selectedTags.filter((tag): tag is string => typeof tag === "string")
      : [];
    const resultTagIds = Array.isArray(body.resultTagIds)
      ? body.resultTagIds.filter((tagId): tagId is string => typeof tagId === "string")
      : [];

    const terms = Array.from(
      new Set([...selectedTags, query].map((term) => term.trim()).filter(Boolean))
    );

    if (terms.length === 0) {
      return NextResponse.json({ error: "検索内容が空です" }, { status: 400 });
    }

    const result = await db.query<{ id: string }>(
      `WITH terms AS (
         SELECT trim(term) AS term
         FROM unnest($1::text[]) AS input(term)
         WHERE trim(term) <> ''
       ),
       matches_tags AS (
         SELECT tag.id
         FROM terms
         JOIN "TagList" tag
           ON terms.term &@~ pgroonga_query_escape(tag.tag)

         UNION ALL

         SELECT subterm."tagId" AS id
         FROM terms
         JOIN "TagSubterm" subterm
           ON terms.term &@~ pgroonga_query_escape(subterm.subterm)
       )
       SELECT DISTINCT id
       FROM matches_tags`,
      [terms]
    );

    const matchedTagIds = result.rows.map((row) => row.id);
    const fallbackTagIds =
      matchedTagIds.length === 0 ? getTopTagIds(resultTagIds, 2) : [];
    const tagIds = matchedTagIds.length > 0 ? matchedTagIds : fallbackTagIds;
    const confidence = matchedTagIds.length > 0 ? 1 : 0.5;

    const searchEvent = await recordSearchEvent({
      userEmail,
      query,
      searchType: "book_list",
      tagIds,
      confidence,
    });

    return NextResponse.json(
      { id: searchEvent.id, tagCount: tagIds.length },
      { status: 201 }
    );
  } catch (error) {
    console.error("検索ログ保存に失敗:", error);
    return NextResponse.json(
      { error: "検索ログ保存に失敗しました" },
      { status: 500 }
    );
  }
}
