import React from 'react'

interface NavigationProps {
  activeSection: string
  setActiveSection: (section: string) => void
  user: any
  isAdmin: boolean
  UserButton: React.ComponentType<any>
  SignInButton: React.ComponentType<any>
  setShowExport: (show: boolean) => void
}

export const Navigation: React.FC<NavigationProps> = ({
  activeSection,
  setActiveSection,
  user,
  isAdmin,
  UserButton,
  SignInButton,
  setShowExport,
}) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-cream/80 backdrop-blur-md border-b border-stone/5">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-charcoal text-cream flex items-center justify-center font-display text-xl">P</div>
          <span className="font-display text-2xl text-charcoal">Rybform</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => setActiveSection('design')} 
            className={`text-sm tracking-wide transition-colors ${activeSection === 'design' ? 'text-charcoal' : 'text-warm-gray hover:text-stone'}`}
          >
            Designer
          </button>
          {user ? (
            <>
              {isAdmin && (
                <>
                  <button 
                    onClick={() => setActiveSection('admin')} 
                    className={`text-sm tracking-wide transition-colors ${activeSection === 'admin' ? 'text-charcoal' : 'text-warm-gray hover:text-stone'}`}
                  >
                    Admin Dashboard
                  </button>
                  <button 
                    onClick={() => setShowExport(true)} 
                    className="text-sm tracking-wide text-oak hover:text-charcoal transition-colors"
                  >
                    Export
                  </button>
                </>
              )}
              <UserButton />
            </>
          ) : (
            <SignInButton mode="modal">
              <button className="btn-primary text-sm py-2 px-5">Sign In</button>
            </SignInButton>
          )}
        </div>
      </div>
    </nav>
  )
}
