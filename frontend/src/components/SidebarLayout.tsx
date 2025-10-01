'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ReactNode, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function SidebarLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    router.push('/')
  }

  const menuItems = [
    { path: '/keyword', label: 'Tra cứu quảng cáo' },
    { path: '/history', label: 'Lịch sử tra cứu' },
    { path: '/profiles', label: 'Quản lý profile' },
  ]

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700 hidden sm:flex flex-col justify-between transition-all duration-300`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            {!collapsed && (
              <div className="text-lg font-bold text-gray-900 dark:text-white">Trang chủ</div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              )}
            </button>
          </div>

          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => router.push(item.path)}
                  className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                    pathname === item.path
                      ? 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {!collapsed && <span>{item.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded-lg font-medium bg-red-100 hover:bg-red-200 text-red-600"
          >
            {!collapsed && 'Đăng xuất'}
            {collapsed && <span className="block text-center">🚪</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
        {children}
      </main>
    </div>
  )
}
