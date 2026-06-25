import { motion, AnimatePresence } from "framer-motion";

interface DeveloperContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Variants ──────────────────────────────────────────────
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.8, rotateY: -15, y: 80 },
  visible: {
    opacity: 1,
    scale: 1,
    rotateY: 0,
    y: 0,
    transition: {
      type: "spring",
      damping: 18,
      stiffness: 260,
      when: "beforeChildren",
      staggerChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    rotateY: 15,
    y: 80,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

const glowPulse = {
  initial: { boxShadow: "0 0 20px rgba(99, 102, 241, 0.3)" },
  animate: {
    boxShadow: [
      "0 0 20px rgba(99, 102, 241, 0.2)",
      "0 0 60px rgba(99, 102, 241, 0.6)",
      "0 0 20px rgba(99, 102, 241, 0.2)",
    ],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
};

export default function DeveloperContactModal({
  isOpen,
  onClose,
}: DeveloperContactModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-2xl"
              variants={glowPulse}
              initial="initial"
              animate="animate"
            >
              {/* Floating decorative shapes */}
              <motion.div
                className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-gradient-to-br from-purple-400/30 to-pink-400/30 blur-3xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-gradient-to-tr from-blue-400/30 to-cyan-400/30 blur-3xl"
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              />

              {/* Gradient Header with moving shimmer */}
              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-6 py-8 text-white">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="absolute right-4 top-4 z-10">
                  <button
                    onClick={onClose}
                    aria-label="Close modal"
                    className="rounded-full bg-white/20 p-1.5 text-white transition hover:bg-white/30 hover:scale-110"
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
                <div className="relative z-10 flex items-center gap-3">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm shadow-lg"
                    whileHover={{ scale: 1.1, rotate: -10 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <span className="text-3xl">👨‍💻</span>
                  </motion.div>
                  <div>
                    <motion.h2
                      className="text-2xl font-bold tracking-tight"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      Need a Custom System?
                    </motion.h2>
                    <motion.p
                      className="text-sm text-indigo-100"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      Built by a professional software engineer
                    </motion.p>
                  </div>
                </div>
                <motion.div
                  className="relative z-10 mt-4 inline-block rounded-full bg-white/20 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ✨ Available for hire
                </motion.div>
              </div>

              {/* Content */}
              <div className="relative z-10 px-6 py-6">
                <motion.p
                  className="text-sm text-gray-600 dark:text-gray-300"
                  variants={itemVariants}
                >
                  This cooperative platform was built with modern, scalable
                  technology. I help organisations digitise operations with
                  custom software solutions.
                </motion.p>

                <div className="mt-6 space-y-3">
                  <motion.a
                    href="mailto:abdullahmusliudeen@gmail.com"
                    whileHover={{
                      scale: 1.03,
                      boxShadow: "0 8px 25px rgba(99,102,241,0.3)",
                    }}
                    whileTap={{ scale: 0.97 }}
                    variants={itemVariants}
                    className="flex items-center gap-3 rounded-xl border border-gray-200/50 bg-white/50 px-4 py-3 transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-indigo-500"
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
                    whileHover={{
                      scale: 1.03,
                      boxShadow: "0 8px 25px rgba(99,102,241,0.3)",
                    }}
                    whileTap={{ scale: 0.97 }}
                    variants={itemVariants}
                    className="flex items-center gap-3 rounded-xl border border-gray-200/50 bg-white/50 px-4 py-3 transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-indigo-500"
                  >
                    <span className="text-xl">🌐</span>
                    <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                      iamabdullahi.netlify.app
                    </span>
                  </motion.a>

                  <motion.a
                    href="https://github.com/muwatta"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{
                      scale: 1.03,
                      boxShadow: "0 8px 25px rgba(99,102,241,0.3)",
                    }}
                    whileTap={{ scale: 0.97 }}
                    variants={itemVariants}
                    className="flex items-center gap-3 rounded-xl border border-gray-200/50 bg-white/50 px-4 py-3 transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-indigo-500"
                  >
                    <span className="text-xl">💼</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      github.com/muwatta
                    </span>
                  </motion.a>
                </div>

                <motion.div
                  className="mt-6 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 p-4 text-center text-sm font-medium text-indigo-800 dark:from-indigo-900/30 dark:to-purple-900/30 dark:text-indigo-200"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  🚀 Build your own cooperative, savings, or loan management
                  system.
                  <br />
                  <span className="font-semibold">
                    Get a custom quote today.
                  </span>
                </motion.div>

                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.03, backgroundColor: "#4f46e5" }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
