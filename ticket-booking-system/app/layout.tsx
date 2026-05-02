import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6">
          {children}
        </div>
      </body>
    </html>
  );
}