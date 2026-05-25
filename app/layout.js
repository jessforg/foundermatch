export const metadata = {
  title: 'FounderMatch — Trouve ton co-fondateur',
  description: 'La plateforme de matching pour entrepreneurs en devenir',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#080810' }}>
        {children}
      </body>
    </html>
  )
}
