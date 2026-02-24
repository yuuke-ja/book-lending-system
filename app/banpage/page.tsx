'use client';

export default function BanPage() {
  const handleLoginAgain = () => {
    window.location.href = '/';
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">アクセスできません</h1>
        <p className="text-gray-600 mb-6">
          申し訳ありません。このサービスはN高生のみご利用いただけます。
        </p>
        <button
          onClick={handleLoginAgain}
          className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          もう一度ログインする
        </button>
      </div>
    </div>
  );
}