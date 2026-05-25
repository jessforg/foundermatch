import { supabase } from '@/lib/supabase'

// POST /api/auth
// body: { action: 'signup'|'login', email, password, name? }
export async function POST(request) {
  const body = await request.json()
  const { action, email, password, name } = body

  if (action === 'signup') {
    // 1. Créer le compte
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return Response.json({ error: error.message }, { status: 400 })

    // 2. Créer le profil vide
    await supabase.from('profiles').insert({
      id: data.user.id,
      name: name || 'Nouveau Fondateur',
      accent: '#4ECDC4',
    })

    return Response.json({ user: data.user, message: 'Compte créé !' })
  }

  if (action === 'login') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return Response.json({ error: error.message }, { status: 401 })
    return Response.json({ user: data.user, session: data.session })
  }

  if (action === 'logout') {
    await supabase.auth.signOut()
    return Response.json({ message: 'Déconnecté' })
  }

  return Response.json({ error: 'Action inconnue' }, { status: 400 })
}
