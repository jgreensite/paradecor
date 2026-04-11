import React from 'react'

interface SuccessModalProps {
  showSuccessModal: boolean
  setShowSuccessModal: (show: boolean) => void
  user: any
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  showSuccessModal,
  setShowSuccessModal,
  user,
}) => {
  if (!showSuccessModal) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={() => setShowSuccessModal(false)} />
      <div className="relative bg-cream rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-stone/10 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-oak/10 text-oak rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
          ✓
        </div>
        <h2 className="font-display text-3xl text-charcoal text-center mb-4">Payment Successful!</h2>
        <div className="space-y-4 text-center">
          <p className="text-stone">
            Thank you for your order! Your custom Rybform design is now being processed for fabrication.
          </p>
          
          {!user && (
            <div className="bg-oak/5 p-4 rounded-2xl border border-oak/10 text-sm">
              <p className="font-bold text-charcoal mb-2">Check Your Email</p>
              <p className="text-stone leading-relaxed">
                Since you checked out as a guest, we've sent a <strong>Clerk Magic Link</strong> to your inbox.
                Click it to create your account and claim your order history!
              </p>
            </div>
          )}
          
          <div className="pt-6">
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="btn-primary w-full py-4 text-lg"
            >
              Return to Designer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
