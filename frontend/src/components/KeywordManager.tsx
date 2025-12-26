'use client'
import { useEffect, useState } from 'react'
import SidebarLayout from './SidebarLayout'

export default function KeywordManager() {
  const [keywords, setKeywords] = useState<any[]>([])
  const [filteredKeywords, setFilteredKeywords] = useState<any[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedKeyword, setEditedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null)
  const [isCrawling, setIsCrawling] = useState(false)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  const [crawlStartTime, setCrawlStartTime] = useState<Date | null>(null)
  const [crawlEndTime, setCrawlEndTime] = useState<Date | null>(null)
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredKeywords.map((kw) => kw._id))
    }
    setSelectAll(!selectAll)
  }

  useEffect(() => {
    fetchKeywords()
  }, [])

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/crawl_status`)
        const data = await res.json()
        if (!mounted) return

        if (data.status === 'running') {
          setIsCrawling(true)
          setCrawlMessage('')
        } else if (data.status === 'done') {
          if (isCrawling) {
            setIsCrawling(false)
            setCrawlEndTime(new Date())
            setCrawlMessage('')
          }
        } else {
          setIsCrawling(false)
        }
      } catch (err) {
        console.error('crawl status error', err)
      }
    }

    poll()
    const id = setInterval(poll, 3000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [API_BASE_URL, isCrawling])



  const fetchKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/keywords/`)
      const data = await res.json()
      const mapped = data.map((kw: any) => ({
        ...kw,
        _id: kw._id?.$oid || kw._id,
      }))
      setKeywords(mapped)
      setFilteredKeywords(mapped)
      setSelectedIds([])
    } catch (e) {
      console.error('Lỗi khi load keywords:', e)
    }
  }

  const removeVietnameseTones = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
  }

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setFilteredKeywords(keywords)
    } else {
      const query = removeVietnameseTones(searchTerm.toLowerCase())
      const filtered = keywords.filter((kw) => {
        const plainKeyword = removeVietnameseTones(kw.keyword.toLowerCase())
        return plainKeyword.includes(query)
      })
      setFilteredKeywords(filtered)
      setPage(1)
    }
  }

  const resetSearch = () => {
    setSearchTerm('')
    setFilteredKeywords(keywords)
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
    setShowAddModal(false)
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

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return
    for (const id of selectedIds) {
      await fetch(`${API_BASE_URL}/api/keywords/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword_id: id }),
      })
    }
    fetchKeywords()
  }

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
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
  const now = new Date()
  setCrawlStartTime(now)
  setCrawlEndTime(null)
  setCrawlMessage(null)

  try {
    const res = await fetch(`${API_BASE_URL}/api/crawl`, { method: 'POST' })
    if (res.status === 202) {
      setCrawlMessage('Tiến trình đã bắt đầu')
      setIsCrawling(true)
    } else if (res.status === 409) {
      const j = await res.json().catch(() => ({ error: 'Conflict' }))
      setCrawlMessage('Không thể bắt đầu: ' + (j.error || 'Đang có tiến trình khác'))
    } else {
      const text = await res.text()
      setCrawlMessage('Lỗi server: ' + text)
    }
  } catch (err) {
    console.error(err)
    setCrawlMessage('Lỗi mạng.')
  } finally {
    setLoading(false)
  }
}

  const totalPages = Math.max(1, Math.ceil(filteredKeywords.length / perPage))
  const paginatedKeywords = filteredKeywords.slice((page - 1) * perPage, page * perPage)

  return (
    <SidebarLayout>
      <section className="bg-gray-50 dark:bg-gray-900 p-3 sm:p-5">
                  <div className="bg-white dark:bg-gray-800 shadow-md sm:rounded-lg overflow-hidden">
          {/* HEADER */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-black dark:text-white">Quản lý từ khoá crawl</h2>
          </div>

          {/* SEARCH */}
          <div className="w-full p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-2 w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Nhập từ khoá để tìm..."
                className="border px-3 py-2 rounded flex-1"
              />
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-black text-white rounded hover:bg-blue-700"
              >
                Tìm kiếm
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-center">
                    <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                  </th>
                  <th className="px-4 py-3">STT</th>
                  <th className="px-4 py-3">Từ khoá</th>
                  <th className="px-4 py-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {paginatedKeywords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-center text-gray-500">
                      Không có từ khoá nào
                    </td>
                  </tr>
                ) : (
                  paginatedKeywords.map((kw, index) => (
                    <tr key={kw._id} className="border-b dark:border-gray-700">
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(kw._id)}
                          onChange={() => toggleSelect(kw._id)}
                        />
                      </td>
                      <td className="px-4 py-2 text-black">{(page - 1) * perPage + index + 1}</td>
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

          <div className="p-4 flex justify-between">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-black text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Thêm từ khoá
            </button>
            <button
              onClick={deleteSelected}
              disabled={selectedIds.length === 0}
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            >
              Xoá đã chọn
            </button>
          </div>

          <div className="p-4 flex justify-between items-center">
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
                  if (page > 3) pages.push('...')
                  const start = Math.max(2, page - 1)
                  const end = Math.min(totalPages - 1, page + 1)
                  for (let i = start; i <= end; i++) pages.push(i)
                  if (page < totalPages - 2) pages.push('...')
                  pages.push(totalPages)
                }
                return pages.map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2">
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      onClick={() => setPage(p as number)}
                      className={`px-3 py-1 rounded ${
                        page === p
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )
              })()}
            </div>
          </div>

          <div className="p-4 flex flex-col items-end">
            <button
              onClick={handleCrawl}
              className="bg-black text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              Bắt đầu tra cứu
            </button>

            {crawlMessage && (
              <div
                className={`text-sm mt-2 ${
                  isCrawling ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}
              >
                {crawlMessage}
                {crawlStartTime && (
                  <span> | Bắt đầu: {crawlStartTime.toLocaleTimeString()}</span>
                )}
                {crawlEndTime && (
                  <span> | Kết thúc: {crawlEndTime.toLocaleTimeString()}</span>
                )}
              </div>
            )}
          </div>
        </div>

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

        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
              <h3 className="text-lg font-bold mb-4 text-blue-700">Thêm từ khoá</h3>
              <input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="border px-3 py-2 w-full rounded mb-4"
                placeholder="Nhập từ khoá (cách nhau bằng dấu ,)"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Huỷ
                </button>
                <button
                  onClick={addKeyword}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Thêm
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </SidebarLayout>
  )
}
