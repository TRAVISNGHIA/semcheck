'use client'
import { useEffect, useState } from 'react'
import SidebarLayout from './SidebarLayout'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

export default function CrawlHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [filter, setFilter] = useState({
    profile_name: '',
    keyword: '',
    link: '',
    domain: '',
  })
  const [timestampFilter, setTimestampFilter] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [inputFilter, setInputFilter] = useState(filter)
  const [showModal, setShowModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/ads`)
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error('Data is not an array')
        setHistory(data.reverse())
      } catch (err) {
        console.error('❌ Error fetching data:', err)
        setError('Failed to fetch data. Check the console for details.')
      }
    }
    fetchData()
  }, [])

  const formatTimestamp = (t: any): string => {
    const d = new Date(t?.$date || t)
    if (isNaN(d.getTime())) return 'N/A'
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const filterAds = () =>
    history.filter((ad) => {
      const ts = new Date(ad.timestamp?.$date || ad.timestamp)

      const matchAny = (field: string | undefined, values: string[]) =>
        values.length === 0 || values.some((val) => field?.toLowerCase().includes(val))

      const getKeywords = (key: keyof typeof filter) =>
        filter[key]
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s !== '')

      const matchDate = () => {
        if (!timestampFilter) return true
        const diff = Math.abs(ts.getTime() - timestampFilter.getTime())
        return diff < 60 * 1000
      }

      return (
        matchAny(ad.profile_name, getKeywords('profile_name')) &&
        matchAny(ad.keyword, getKeywords('keyword')) &&
        matchAny(ad.link, getKeywords('link')) &&
        matchAny(ad.domain, getKeywords('domain')) &&
        matchDate()
      )
    })

  const filtered = filterAds()
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputFilter({ ...inputFilter, [e.target.name]: e.target.value })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setFilter(inputFilter)
      setPage(1)
    }
  }

  const fields = [
    { name: 'profile_name', placeholder: 'Profile a, Profile b,...', title: 'Profile Name' },
    { name: 'keyword', placeholder: 'keyword a, keyword b,...', title: 'Keyword' },
    { name: 'link', placeholder: 'https://example.com...', title: 'Link' },
    { name: 'domain', placeholder: 'example.com...', title: 'Domain' },
  ]

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    setScale((s) => {
      const next = e.deltaY < 0 ? s + 0.1 : s - 0.1
      return Math.min(Math.max(next, 0.5), 5)
    })
  }

  return (
    <SidebarLayout>
      <section className="bg-gray-50 dark:bg-gray-900 p-3 sm:p-5">
        <div className="bg-white dark:bg-gray-800 shadow-md sm:rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-black dark:text-white">Lịch sử tra cứu</h2>
          </div>
          {error && <div className="p-4 text-red-500">{error}</div>}
          <div className="p-4 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            {fields.map((f) => (
              <div key={f.name} className="flex flex-col">
                <label
                  htmlFor={f.name}
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {f.title}
                </label>
                <input
                  id={f.name}
                  type="text"
                  name={f.name}
                  value={(inputFilter as any)[f.name]}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={f.placeholder}
                  className="p-2 border rounded text-black placeholder-gray-400"
                />
              </div>
            ))}

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Timestamp
              </label>
              <DatePicker
                selected={timestampFilter}
                onChange={(date) => {
                  setTimestampFilter(date)
                  setPage(1)
                }}
                showTimeSelect
                timeFormat="HH:mm:ss"
                timeIntervals={1}
                dateFormat="yyyy-MM-dd HH:mm:ss"
                placeholderText="yyyy-mm-dd hh:mm:ss"
                className="p-2 border rounded w-full text-black placeholder-gray-400"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-transparent mb-1">.</label>
              <button
                onClick={() => {
                  setFilter(inputFilter)
                  setPage(1)
                }}
                className="p-2 bg-black text-white font-medium rounded hover:bg-gray-800"
              >
                Tìm kiếm
              </button>
            </div>
          </div>

          {/* Bảng kết quả */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">STT</th>
                  <th className="px-4 py-3">Profile</th>
                  <th className="px-4 py-3">Keyword</th>
                  <th className="px-4 py-3">Link</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Advertiser</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Image</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-2 text-center text-gray-500">
                      No data available
                    </td>
                  </tr>
                ) : (
                  paginated.map((ad, index) => (
                    <tr key={index} className="border-b dark:border-gray-700 text-black">
                      <td className="px-4 py-2">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-4 py-2">{ad.profile_name}</td>
                      <td className="px-4 py-2">{ad.keyword}</td>
                      <td className="px-4 py-2 max-w-xs">
                         {ad.link ? (
                           <a
                             href={ad.link}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-blue-500 hover:underline block truncate"
                             title={ad.link}
                           >
                             {ad.link}
                           </a>
                         ) : (
                           'N/A'
                         )}
                       </td>
                      <td className="px-4 py-2">{ad.domain}</td>
                      <td className="px-4 py-2">{ad.advertiser}</td>
                      <td className="px-4 py-2">{formatTimestamp(ad.timestamp)}</td>
                      <td className="px-4 py-2">
                        {ad.screenshot_path ? (
                          <img
                            src={`${process.env.NEXT_PUBLIC_R2_URL}/${ad.screenshot_path}`}
                            alt="Ad"
                            className="w-16 h-16 object-cover cursor-pointer hover:scale-105 transition rounded"
                            onClick={() => {
                              setSelectedImage(`${process.env.NEXT_PUBLIC_R2_URL}/${ad.screenshot_path}`)
                              setShowModal(true)
                              setScale(1)
                              setTranslate({ x: 0, y: 0 })
                            }}
                          />
                        ) : (
                          'No Image'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Hiển thị</span>

              <input
                type="number"
                min={1}
                value={perPage}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (val > 0) {
                    setPerPage(val)
                    setPage(1)
                  }
                }}
                list="perPageOptions"
                className="p-2 border rounded w-20 text-center"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                sản phẩm / trang
              </span>
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
        </div>
      </section>

      {/* Modal hiển thị ảnh */}
      {showModal && selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center
                     bg-white/30 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
          onWheel={handleWheel}
        >
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              className="px-3 py-1 bg-white rounded shadow hover:bg-gray-200"
              onClick={(e) => {
                e.stopPropagation()
                setScale((s) => Math.max(s - 0.1, 0.5))
              }}
            >
              -
            </button>
            <button
              className="px-3 py-1 bg-white rounded shadow hover:bg-gray-200"
              onClick={(e) => {
                e.stopPropagation()
                setScale((s) => Math.min(s + 0.1, 5))
              }}
            >
              +
            </button>
          </div>

          <div
            className="cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => {
              e.preventDefault()
              const startX = e.clientX
              const startY = e.clientY
              const initX = translate.x
              const initY = translate.y

              const onMouseMove = (ev: MouseEvent) => {
                setTranslate({
                  x: initX + (ev.clientX - startX),
                  y: initY + (ev.clientY - startY),
                })
              }

              const onMouseUp = () => {
                window.removeEventListener("mousemove", onMouseMove)
                window.removeEventListener("mouseup", onMouseUp)
              }

              window.addEventListener("mousemove", onMouseMove)
              window.addEventListener("mouseup", onMouseUp)
            }}
          >
            <img
              src={selectedImage}
              alt="Full Ad"
              className="rounded shadow-lg transition-transform select-none"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transformOrigin: "center",
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}
