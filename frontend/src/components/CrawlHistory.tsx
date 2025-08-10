'use client'
import { useEffect, useState } from 'react'
import SidebarLayout from './SidebarLayout'

export default function CrawlHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [filter, setFilter] = useState({
    profile_name: '',
    keyword: '',
    link: '',
    domain: '',
    timestamp: '',
  })
  const [page, setPage] = useState(1)
  const perPage = 25

  const [showModal, setShowModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

  // Fetch dữ liệu khi load trang
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

  // Format lại timestamp dạng YYYY-MM-DD HH:MM:SS
  const formatTimestamp = (t: any): string => {
    const d = new Date(t?.$date || t)
    if (isNaN(d.getTime())) return 'N/A'

    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  // Lọc dữ liệu theo filter nhập
  const filterAds = () =>
    history.filter((ad) => {
      const ts = formatTimestamp(ad.timestamp).toLowerCase()

      const matchAny = (field: string | undefined, values: string[]) =>
        values.length === 0 || values.some((val) => field?.toLowerCase().includes(val))

      const getKeywords = (key: keyof typeof filter) =>
        filter[key]
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s !== '')

      return (
        matchAny(ad.profile_name, getKeywords('profile_name')) &&
        matchAny(ad.keyword, getKeywords('keyword')) &&
        matchAny(ad.link, getKeywords('link')) &&
        matchAny(ad.domain, getKeywords('domain')) &&
        matchAny(ts, getKeywords('timestamp'))
      )
    })

  const filtered = filterAds()
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  // Xử lý thay đổi filter input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter({ ...filter, [e.target.name]: e.target.value })
    setPage(1) // reset về trang đầu tiên khi tìm kiếm
  }

  // Các trường filter
const fields = [
  {
    name: 'profile_name',
    placeholder: 'Profile a, Profile b,...',
    title: 'Profile Name',
  },
  {
    name: 'keyword',
    placeholder: 'keyword a, keyword b,...',
    title: 'Keyword',
  },
  {
    name: 'link',
    placeholder: 'https://example.com...',
    title: 'Link',
  },
  {
    name: 'timestamp',
    placeholder: 'yyyy/mm/dd hh:mm:ss',
    title: 'Timestamp',
  },
]


  return (
   <SidebarLayout>
    <section className="bg-gray-50 dark:bg-gray-900 p-3 sm:p-5">
        <div className="bg-white dark:bg-gray-800 shadow-md sm:rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-black dark:text-white">Lịch sử tra cứu</h2>
          </div>
          {/* Lỗi nếu fetch fail */}
          {error && <div className="p-4 text-red-500">{error}</div>}

          {/* Ô filter */}
          <div className="p-4 flex flex-col md:flex-row justify-between gap-4">
            {fields.map((f) => (
              <div key={f.name} className="flex flex-col w-full md:w-1/5">
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
                    value={(filter as any)[f.name]}
                    onChange={handleChange}
                    placeholder={f.placeholder}
                    className="p-2 border rounded"
                  />
              </div>
            ))}
          </div>

          {/* Bảng hiển thị kết quả */}
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
                    <tr key={index} className="border-b dark:border-gray-700">
                      <td className="px-4 py-2">{(page - 1) * perPage + index + 1}</td>
                      <td className="px-4 py-2">{ad.profile_name}</td>
                      <td className="px-4 py-2">{ad.keyword}</td>
                      <td className="px-4 py-2 break-all">
                        {ad.link ? (
                          <a
                            href={ad.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            {ad.link.length > 50 ? `${ad.link.slice(0, 50)}...` : ad.link}
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

          {/* Phân trang */}
          <div className="flex justify-center mt-4 p-4 gap-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                className={`px-3 py-1 border rounded ${page === i + 1 ? 'bg-blue-500 text-white' : 'bg-white'}`}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

      {/* Modal hiển thị ảnh khi bấm vào thumbnail */}
      {showModal && selectedImage && (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-75 flex justify-center items-center z-50">
          <img src={selectedImage} alt="Preview" className="max-w-full max-h-full" />
          <button
            onClick={() => setShowModal(false)}
            className="absolute top-4 right-4 text-white text-xl font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </section>
   </SidebarLayout>
  )
}
