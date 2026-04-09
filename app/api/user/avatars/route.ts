import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/auth';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server only
const supabase = createClient(url, serviceKey);
const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];

export async function POST(req: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: '認証していません' }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) {
    return NextResponse.json(
      { error: '画像ファイルが選択されていません' },
      { status: 400 }
    );
  }

  if (!allowedTypes.includes(file.type)) {
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

  const arrayBuffer = await file.arrayBuffer();
  const key = `uploads/${crypto.randomUUID()}-${file.name}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(key, Buffer.from(arrayBuffer), {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      { error: '画像のアップロードに失敗しました' },
      { status: 500 }
    );
  }

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(key);

  return NextResponse.json({ url: data?.publicUrl, path: key });
}
