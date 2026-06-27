import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAtom } from 'jotai'
import { userAtom, loadingAtom } from '../stores/authAtom'
import { useThemeApplier } from '../stores/themeAtom'
import { supabase } from '../lib/supabaseClient'
import { Toaster } from 'react-hot-toast'
import Header from './Header'
import Footer from './Footer'
import './Layout.css'

const Layout = () => {
    const [, setUser] = useAtom(userAtom)
    const [loading, setLoading] = useAtom(loadingAtom)
    useThemeApplier()

    useEffect(() => {
        // Inicializar la sesión cuando se carga la aplicación
        const initSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession()
            if (session?.user) {
                setUser({
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.name || session.user.email
                })
            } else {
                setUser(null)
            }
            setLoading(false)
        }

        initSession()

        // Escuchar cambios de estado en la autenticación (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser({
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.name || session.user.email
                })
            } else {
                setUser(null)
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [setUser, setLoading])

    if (loading) {
        return <div className="layout-loading">Cargando...</div>
    }

    return (
        <div className="layout-container">
            <Toaster position="top-right" />
            <Header />
            <main className="layout-main">
                <Outlet />
            </main>
            <Footer />
        </div>
    )

}

export default Layout