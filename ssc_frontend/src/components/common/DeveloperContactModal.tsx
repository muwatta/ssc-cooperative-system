interface DeveloperContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeveloperContactModal({
  isOpen,
  onClose,
}: DeveloperContactModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          ✕
        </button>

        <div className="text-center">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">👨‍💻</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            Need a Custom System?
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            This cooperative platform was built by a professional software
            engineer. Contact the developer for custom solutions.
          </p>
        </div>

        <div className="mt-6 space-y-2 text-sm">
          <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
            <span className="text-lg">📧</span>
            <span>abdullahmusliudeen@gmail.com</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
            <span className="text-lg">🌐</span>
            <a
              href="https://iamabdullahi.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              iamabdullahi.netlify.app
            </a>
          </div>
          <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
            <span className="text-lg">💼</span>
            <a
              href="https://github.com/muwatta"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              github.com/muwatta
            </a>
          </div>
        </div>

        <div className="mt-6 bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3 text-xs text-primary-700 dark:text-primary-300 text-center">
          🚀 Build your own cooperative, savings, or loan management system. Get
          a custom quote today.
        </div>

        <button onClick={onClose} className="mt-4 w-full btn-primary py-2">
          Close
        </button>
      </div>
    </div>
  );
}
