import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "図書貸出システム",
    short_name: "Library",
    description: "本の貸出・返却管理アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon/appicon.png",
        sizes: "1254x1254",
        type: "image/png"
      },
      {
        src: "/icon/appicon.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  }
}
