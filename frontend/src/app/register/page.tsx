'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    await new Promise((resolve) => setTimeout(resolve, 1500))

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || 'Lỗi đăng ký')
        setLoading(false)
        return
      }

      setSuccess('Đăng ký thành công')
      setLoading(false)

      setTimeout(() => {
        router.push('/')
      }, 1500)
    } catch (err) {
      setError('Lỗi server hoặc mạng')
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleRegister()
      }}
      className="flex flex-col items-center justify-center min-h-screen gap-4"
    >
      <h1 className="text-2xl font-bold">Đăng ký</h1>

      <input
        className="border p-2 w-64"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        className="border p-2 w-64"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="text-red-500">{error}</p>}

      {success && <p className="text-green-600">{success}</p>}

      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={loading}
      >
        Đăng ký
      </button>

      {loading && <p className="text-gray-600 text-sm">Đang đăng ký...</p>}

      <p>
        Đã có tài khoản?{' '}
        <span
          className="text-blue-600 cursor-pointer underline"
          onClick={() => router.push('/')}
        >
          Đăng nhập
        </span>
      </p>
    </form>
  )
}
