import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server only
const supabase = createClient(url, serviceKey);
const extensionByType: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function POST(req: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: '認証していません' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (error) {
    console.error('プロフィール画像のFormData解析に失敗:', error);
    return NextResponse.json(
      { error: 'リクエストの解析に失敗しました' },
      { status: 400 }
    );
  }
  const file = form.get('file') as File | null;
  if (!file) {
    return NextResponse.json(
      { error: '画像ファイルが選択されていません' },
      { status: 400 }
    );
  }

  const extension = extensionByType[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: 'PNG、JPEG、WebP形式の画像のみアップロードできます' },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: '画像サイズは5MB以下にしてください' },
      { status: 400 }
    );
  }

  try {
    const userResult = await db.query<{ id: string }>(
      `SELECT id
       FROM "User"
       WHERE email = $1
       LIMIT 1`,
      [userEmail]
    );
    const userId = userResult.rows[0]?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const key = `uploads/${userId}/avatar`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(key, Buffer.from(arrayBuffer), {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: '画像のアップロードに失敗しました' },
        { status: 500 }
      );
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(key);
    const publicUrl = new URL(data.publicUrl);
    publicUrl.searchParams.set('v', Date.now().toString());

    return NextResponse.json({
      url: publicUrl.toString(),
      path: key,
    });
  } catch (error) {
    console.error('プロフィール画像の処理に失敗:', error);
    return NextResponse.json(
      { error: 'プロフィール画像の処理に失敗しました' },
      { status: 500 }
    );
  }
}
