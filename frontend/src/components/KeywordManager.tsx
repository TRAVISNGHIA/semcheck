'use client'
import { useEffect, useState } from 'react'
import SidebarLayout from './SidebarLayout'

export default function KeywordManager() {
  const [keywords, setKeywords] = useState<any[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedKeyword, setEditedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [interval, setInterval] = useState(5)
  const [unit, setUnit] = useState<'seconds' | 'minutes' | 'hours'>('minutes')
  const [saving, setSaving] = useState(false)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  useEffect(() => {
    fetchKeywords()
    fetchSchedulerConfig()
  }, [])

  const fetchKeywords = async () => {
    const res = await fetch(`${API_BASE_URL}/api/keywords`)
    const data = await res.json()
    const mapped = data.map((kw: any) => ({
      ...kw,
      _id: kw._id.$oid || kw._id,
    }))
    setKeywords(mapped)
  }

  const fetchSchedulerConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/scheduler/config`)
      const data = await res.json()
      if (data.interval) setInterval(data.interval)
      if (data.unit) setUnit(data.unit)
    } catch (error) {
      console.error('Lỗi khi load config scheduler:', error)
    }
  }

  const addKeyword = async () => {
    if (!newKeyword.trim()) return

    const list = newKeyword
      .split(',')
      .map((kw) => kw.trim())
      .filter((kw) => kw.length > 0)

    if (list.length === 0) return

    for (const kw of list) {
      await fetch(`${API_BASE_URL}/api/keywords/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw }),
      })
    }

    setNewKeyword('')
    fetchKeywords()
  }

  const deleteKeyword = async (id: string) => {
    await fetch(`${API_BASE_URL}/api/keywords/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword_id: id }),
    })
    fetchKeywords()
  }

  const openEditModal = (id: string, currentKeyword: string) => {
    setEditingId(id)
    setEditedKeyword(currentKeyword)
    setShowModal(true)
  }

  const updateKeyword = async () => {
    if (!editedKeyword.trim() || !editingId) return
    await fetch(`${API_BASE_URL}/api/keywords/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword_id: editingId,
        new_keyword: editedKeyword,
      }),
    })
    setShowModal(false)
    setEditingId(null)
    setEditedKeyword('')
    fetchKeywords()
  }

  const handleCrawl = async () => {
    setLoading(true)
    await fetch(`${API_BASE_URL}/api/crawl`, { method: 'POST' })
    setLoading(false)
    alert('Tra cứu đã xong')
  }

  const saveSchedulerConfig = async () => {
    setSaving(true)
    try {
      await fetch(`${API_BASE_URL}/api/scheduler/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interval,
          unit,
        }),
      })
      alert('Đã lưu cấu hình thời gian!')
    } catch (error) {
      console.error('Lỗi khi lưu interval:', error)
      alert('Lưu thất bại, check console.')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(keywords.length / perPage)
  const paginatedKeywords = keywords.slice((page - 1) * perPage, page * perPage)
  return (
    <SidebarLayout>
      <section className="bg-gray-50 dark:bg-gray-900 p-3 sm:p-5">
        <div className="bg-white dark:bg-gray-800 shadow-md sm:rounded-lg overflow-hidden">

          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-black dark:text-white">Quản lý từ khoá crawl</h2>
          </div>

          {/* thêm keyword */}
           <div className="p-4 flex flex-col md:flex-row gap-3">
             <input
               type="text"
               value={newKeyword}
               onChange={(e) => setNewKeyword(e.target.value)}
               placeholder="Nhập keyword mới..."
               className="flex-1 p-2 border rounded text-black placeholder-gray-400"
             />
             <button
               onClick={addKeyword}
               className="bg-black text-white px-4 py-2 rounded hover:bg-blue-700"
             >
               Thêm
             </button>
           </div>

          {/* Table keyword */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">STT</th>
                  <th className="px-4 py-3">Từ khoá</th>
                  <th className="px-4 py-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {paginatedKeywords.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-center text-gray-500">
                      Không có từ khoá nào
                    </td>
                  </tr>
                ) : (
                  paginatedKeywords.map((kw, index) => (
                    <tr key={kw._id} className="border-b dark:border-gray-700">
                      <td className="px-4 py-2 text-black">
                        {(page - 1) * perPage + index + 1}
                      </td>
                      <td className="px-4 py-2 text-black">{kw.keyword}</td>
                      <td className="px-4 py-2 text-center space-x-2">
                        <button
                          onClick={() => openEditModal(kw._id, kw.keyword)}
                          className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-blue-700 transition"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => deleteKeyword(kw._id)}
                          className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-red-700 transition"
                        >
                          Xoá
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Hiển thị</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value))
                  setPage(1)
                }}
                className="p-2 border rounded"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-700 dark:text-gray-300">Từ Khóa / trang</span>
            </div>

            <div className="flex items-center gap-2">
              {(() => {
                const pages: (number | string)[] = []
                if (totalPages <= 6) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i)
                } else {
                  pages.push(1)
                  if (page > 3) pages.push("...")
                  const start = Math.max(2, page - 1)
                  const end = Math.min(totalPages - 1, page + 1)
                  for (let i = start; i <= end; i++) pages.push(i)
                  if (page < totalPages - 2) pages.push("...")
                  pages.push(totalPages)
                }

                return pages.map((p, idx) =>
                  p === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-2">
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      onClick={() => setPage(p as number)}
                      className={`px-3 py-1 rounded ${
                        page === p
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )
              })()}
            </div>
          </div>

          {/* Form chỉnh scheduler */}
          <div className="p-4">
            <h3 className="text-lg font-bold mb-3 text-black dark:text-white">
              Cài đặt thời gian chạy tự động
            </h3>
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <input
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="p-2 border rounded w-24"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as 'seconds' | 'minutes' | 'hours')}
                className="p-2 border rounded"
              >
                <option value="seconds">Giây</option>
                <option value="minutes">Phút</option>
                <option value="hours">Giờ</option>
              </select>
              <button
                onClick={saveSchedulerConfig}
                disabled={saving}
                className="bg-black text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>

          {/* Nút crawl */}
          <div className="p-4 flex justify-end">
            <button
              onClick={handleCrawl}
              disabled={loading}
              className="bg-black text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              {loading ? 'Đang crawl...' : 'Bắt đầu tra cứu'}
            </button>
          </div>
        </div>

        {/* Modal sửa keyword */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Sửa từ khoá</h3>
              <input
                value={editedKeyword}
                onChange={(e) => setEditedKeyword(e.target.value)}
                className="border px-3 py-2 w-full rounded mb-4"
                placeholder="Nhập từ khoá mới"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Huỷ
                </button>
                <button
                  onClick={updateKeyword}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </SidebarLayout>
  )
}
