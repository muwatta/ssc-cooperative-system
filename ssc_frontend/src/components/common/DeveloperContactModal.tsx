import { motion, AnimatePresence } from "framer-motion";

interface DeveloperContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DeveloperContactModal({
  isOpen,
  onClose,
}: DeveloperContactModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
              {/* Gradient Header */}
              <div className="relative bg-gradient-to-br from-primary-600 via-primary-500 to-indigo-600 px-6 py-8 text-white">
                <div className="absolute right-4 top-4">
                  <button
                    onClick={onClose}
                    aria-label="Close modal"
                    className="rounded-full bg-white/20 p-1.5 text-white transition hover:bg-white/30"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                    <span className="text-3xl">👨‍💻</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                      Need a Custom System?
                    </h2>
                    <p className="text-sm text-primary-100">
                      Built by a professional software engineer
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                  ✨ Available for hire
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  This cooperative platform was built with modern, scalable
                  technology. I help organisations digitise operations with
                  custom software solutions.
                </p>

                <div className="mt-6 space-y-3">
                  <motion.a
                    href="mailto:abdullahmusliudeen@gmail.com"
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 transition hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                  >
                    <span className="text-xl">📧</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      abdullahmusliudeen@gmail.com
                    </span>
                  </motion.a>

                  <motion.a
                    href="https://iamabdullahi.netlify.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 transition hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                  >
                    <span className="text-xl">🌐</span>
                    <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                      iamabdullahi.netlify.app
                    </span>
                  </motion.a>

                  <motion.a
                    href="https://github.com/muwatta"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 transition hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                  >
                    <span className="text-xl">💼</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      github.com/muwatta
                    </span>
                  </motion.a>
                </div>

                <div className="mt-6 rounded-lg bg-gradient-to-r from-primary-50 to-indigo-50 p-4 text-center text-sm text-primary-800 dark:from-primary-900/30 dark:to-indigo-900/30 dark:text-primary-200">
                  🚀 Build your own cooperative, savings, or loan management
                  system.
                  <br />
                  <span className="font-semibold">
                    Get a custom quote today.
                  </span>
                </div>

                <button
                  onClick={onClose}
                  className="mt-4 w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
