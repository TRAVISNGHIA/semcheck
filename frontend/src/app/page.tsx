// 'use client'
//
// import { useState } from 'react'
// import { useRouter } from 'next/navigation'
//
// export default function LoginPage() {
//   const router = useRouter()
//   const [username, setUsername] = useState('')
//   const [password, setPassword] = useState('')
//   const [error, setError] = useState('')
//   const [loading, setLoading] = useState(false)
//
//   const handleLogin = async () => {
//     setError('')
//     setLoading(true)
//
//     await new Promise((resolve) => setTimeout(resolve, 1500))
//
//     try {
//       const res = await fetch('http://localhost:8000/api/user/login', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ username, password }),
//       })
//
//       if (!res.ok) {
//         const data = await res.json()
//         setError(data.detail || 'Lỗi đăng nhập')
//         setLoading(false)
//         return
//       }
//
//       const data = await res.json()
//       router.push('/keyword')
//     } catch (err) {
//       setError('Lỗi server hoặc mạng')
//       setLoading(false)
//     }
//   }
//
//   return (
//     <form
//       onSubmit={(e) => {
//         e.preventDefault()
//         handleLogin()
//       }}
//       className="flex flex-col items-center justify-center min-h-screen gap-4"
//     >
//       <h1 className="text-2xl font-bold">Đăng nhập</h1>
//       <input
//         className="border p-2 w-64"
//         placeholder="Username"
//         value={username}
//         onChange={(e) => setUsername(e.target.value)}
//       />
//       <input
//         className="border p-2 w-64"
//         type="password"
//         placeholder="Password"
//         value={password}
//         onChange={(e) => setPassword(e.target.value)}
//       />
//       {error && <p className="text-red-500">{error}</p>}
//       <button
//         type="submit"
//         className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
//         disabled={loading}
//       >
//         Đăng nhập
//       </button>
//       {loading && <p className="text-gray-600 text-sm">Đang đăng nhập...</p>}
//       <p>
//         Chưa có tài khoản?{' '}
//         <span
//           className="text-blue-600 cursor-pointer underline"
//           onClick={() => router.push('/register')}
//         >
//           Đăng ký
//         </span>
//       </p>
//     </form>
//   )
// }
'use client'

import KeywordManager from '@/components/KeywordManager'

export default function KeywordPage() {
  return <KeywordManager />
}
