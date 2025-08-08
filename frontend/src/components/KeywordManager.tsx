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

  useEffect(() => {
    fetchKeywords()
  }, [])

  const fetchKeywords = async () => {
    const res = await fetch('http://localhost:8000/api/keywords')
    const data = await res.json()
    setKeywords(data)
  }

  const addKeyword = async () => {
    if (!newKeyword.trim()) return
    await fetch('http://localhost:8000/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: newKeyword }),
    })
    setNewKeyword('')
    fetchKeywords()
  }

  const deleteKeyword = async (id: string) => {
    await fetch(`http://localhost:8000/api/keywords/${id}`, { method: 'DELETE' })
    fetchKeywords()
  }

  const openEditModal = (id: string, currentKeyword: string) => {
    setEditingId(id)
    setEditedKeyword(currentKeyword)
    setShowModal(true)
  }

  const updateKeyword = async () => {
    if (!editedKeyword.trim() || !editingId) return
    await fetch(`http://localhost:8000/api/keywords/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: editedKeyword }),
    })
    setShowModal(false)
    setEditingId(null)
    setEditedKeyword('')
    fetchKeywords()
  }

  const handleCrawl = async () => {
    setLoading(true)
    await fetch('http://localhost:8000/api/crawl', { method: 'POST' })
    setLoading(false)
    alert('Crawl xong rồi!')
  }

  return (
   <SidebarLayout>
    <section className="bg-gray-50 dark:bg-gray-900 p-3 sm:p-5">
        <div className="bg-white dark:bg-gray-800 shadow-md sm:rounded-lg overflow-hidden">

          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-black dark:text-white">Quản lý từ khoá crawl</h2>
          </div>

          {/* Form thêm keyword */}
          <div className="p-4 flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Nhập keyword mới..."
              className="flex-1 p-2 border rounded"
            />
            <button
              onClick={addKeyword}
              className="bg-black text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Thêm
            </button>
          </div>

          {/* Table hiển thị keyword */}
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
                {keywords.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-center text-gray-500">
                      Không có từ khoá nào
                    </td>
                  </tr>
                ) : (
                  keywords.map((kw, index) => (
                    <tr key={kw._id} className="border-b dark:border-gray-700">
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2">{kw.keyword}</td>
                      <td className="px-4 py-2 text-center space-x-4">
                        <button
                          onClick={() => openEditModal(kw._id, kw.keyword)}
                          className="text-blue-600 hover:underline"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => deleteKeyword(kw._id)}
                          className="text-red-600 hover:underline"
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

          {/* Nút crawl */}
          <div className="p-4 flex justify-center">
            <button
              onClick={handleCrawl}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            >
              {loading ? 'Đang crawl...' : 'Tra cứu từ khoá'}
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
