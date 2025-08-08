'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ReactNode } from 'react'

export default function SidebarLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    router.push('/')
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700 hidden sm:flex flex-col justify-between">
        <div className="p-4">
          <div className="text-lg font-bold text-gray-900 dark:text-white mb-4">Trang chủ</div>
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => router.push('/keyword')}
                className={`w-full text-left px-4 py-2 rounded-lg font-medium ${
                  pathname === '/keyword'
                    ? 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                Tra cứu quảng cáo
              </button>
            </li>
            <li>
              <button
                onClick={() => router.push('/history')}
                className={`w-full text-left px-4 py-2 rounded-lg font-medium ${
                  pathname === '/history'
                    ? 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                Lịch sử tra cứu
              </button>
            </li>
            {/* Tab quản lý profile luôn hiển thị */}
            <li>
              <button
                  onClick={() => router.push('/profiles')}
                  className={`w-full text-left px-4 py-2 rounded-lg font-medium ${
                      pathname === '/profiles'
                  ? 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
              >
                Quản lý profile
              </button>
            </li>
          </ul>
        </div>

        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded-lg font-medium bg-red-100 hover:bg-red-200 text-red-600"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
        {children}
      </main>
    </div>
  )
}
