'use client'
import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from './SidebarLayout'
import DatePicker from 'react-datepicker'
import dynamic from 'next/dynamic'

const Select = dynamic(() => import('react-select'), { ssr: false })

import 'react-datepicker/dist/react-datepicker.css'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

export default function CrawlHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [filter, setFilter] = useState({
    profile_name: '',
    keyword: '',
    link: '',
    domain: '',
  })
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const [startDate, setStartDate] = useState<Date | null>(yesterday)
  const [endDate, setEndDate] = useState<Date | null>(today)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [inputFilter, setInputFilter] = useState(filter)
  const [showModal, setShowModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')

  // đa lựa chọn
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [domainHistory, setDomainHistory] = useState<string[][]>([])
  const [profileHistory, setProfileHistory] = useState<string[][]>([])

  useEffect(() => {
    const dSaved = localStorage.getItem('domainSearchHistory')
    const pSaved = localStorage.getItem('profileSearchHistory')
    if (dSaved) setDomainHistory(JSON.parse(dSaved))
    if (pSaved) setProfileHistory(JSON.parse(pSaved))
  }, [])

  useEffect(() => {
    localStorage.setItem('domainSearchHistory', JSON.stringify(domainHistory))
  }, [domainHistory])
  useEffect(() => {
    localStorage.setItem('profileSearchHistory', JSON.stringify(profileHistory))
  }, [profileHistory])

  const handleSelect = (
    e: React.ChangeEvent<HTMLSelectElement>,
    selectedList: string[],
    setSelectedList: (val: string[]) => void,
    setInputKey: string
  ) => {
    const value = e.target.value
    if (value && !selectedList.includes(value)) {
      setSelectedList([...selectedList, value])
    }
    setInputFilter({ ...inputFilter, [setInputKey]: '' })
  }

  const removeSelected = (
    item: string,
    selectedList: string[],
    setSelectedList: (val: string[]) => void
  ) => {
    setSelectedList(selectedList.filter((i) => i !== item))
  }

  const saveHistory = (
    selectedList: string[],
    historyList: string[][],
    setHistoryList: (val: string[][]) => void
  ) => {
    if (selectedList.length === 0) return
    const newHistory = [
      selectedList,
      ...historyList.filter(
        (h) => JSON.stringify(h) !== JSON.stringify(selectedList)
      ),
    ].slice(0, 10)
    setHistoryList(newHistory)
  }

  const handleSearch = () => {
    setFilter({
      ...inputFilter,
      profile_name: selectedProfiles.join(','),
      domain: selectedDomains.join(','),
    })
    setPage(1)
    if (selectedDomains.length > 0)
      saveHistory(selectedDomains, domainHistory, setDomainHistory)
    if (selectedProfiles.length > 0)
      saveHistory(selectedProfiles, profileHistory, setProfileHistory)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/ads`)
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error('Data is not an array')

        const limitedData = data.slice(-500)
        setHistory(limitedData.reverse())
      } catch (err) {
        setError('lỗi tải dữ liệu.')
      }
    }
    fetchData()
  }, [API_BASE_URL])

  const formatTimestamp = (t: any): string => {
    const d = new Date(t?.$date || t)
    if (isNaN(d.getTime())) return 'N/A'
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const availableProfiles = useMemo(
    () => Array.from(new Set(history.map((h) => h.profile_name).filter(Boolean))).sort(),
    [history]
  )
  const availableDomains = useMemo(
    () => Array.from(new Set(history.map((h) => h.domain).filter(Boolean))).sort(),
    [history]
  )

  const filterAds = () =>
    history.filter((ad) => {
      const ts = new Date(ad.timestamp?.$date || ad.timestamp)

      const match = (field: string | undefined, value: string) =>
        !value || field?.toLowerCase().includes(value.toLowerCase())

      const matchDateRange = () => {
        if (!startDate && !endDate) return true
        const tsDay = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate())
        if (startDate && tsDay < new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()))
          return false
        if (endDate && tsDay > new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()))
          return false
        return true
      }

      return (
        (selectedProfiles.length === 0 ||
          selectedProfiles.includes(ad.profile_name)) &&
        (selectedDomains.length === 0 ||
          selectedDomains.includes(ad.domain)) &&
        match(ad.keyword, filter.keyword) &&
        match(ad.link, filter.link) &&
        matchDateRange()
      )
    })

  const filtered = filterAds()
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ad of filtered) {
      const key = (ad.domain || 'N/A').toString()
      counts[key] = (counts[key] || 0) + 1
    }
    return Object.entries(counts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputFilter({ ...inputFilter, [e.target.name]: e.target.value })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    setScale((s) => Math.min(Math.max(s + (e.deltaY < 0 ? 0.1 : -0.1), 0.5), 5))
  }

  return (
    <SidebarLayout>
      <section className="bg-gray-50 dark:bg-gray-900 p-3 sm:p-5">
        <div className="bg-white dark:bg-gray-800 shadow-md sm:rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-black dark:text-white">Lịch sử tra cứu</h2>
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'chart' : 'table')}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              {viewMode === 'table' ? 'Chuyển sang Biểu đồ' : 'Chuyển sang Bảng'}
            </button>
          </div>

          {error && <div className="p-4 text-red-500">{error}</div>}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch()
            }}
            className="p-4 flex flex-wrap gap-3 items-end"
          >
            {/* Profile */}
            <div className="flex flex-col flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profile</label>
              <Select
                isMulti
                options={availableProfiles.map((p) => ({ value: p, label: p }))}
                value={selectedProfiles.map((p) => ({ value: p, label: p }))}
                onChange={(selected) => setSelectedProfiles(selected.map((s) => s.value))}
                placeholder="Chọn profile..."
                className="text-black"
                styles={{
                  control: (base) => ({
                    ...base,
                    backgroundColor: 'white',
                    borderColor: '#ccc',
                  }),
                }}
              />
            </div>

            {/* Keyword */}
            <div className="flex flex-col flex-1 min-w-[160px]">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keyword</label>
              <input
                name="keyword"
                value={inputFilter.keyword}
                onChange={handleInputChange}
                placeholder="Từ khóa..."
                className="p-2 border rounded text-black placeholder-gray-400 w-full"
              />
            </div>

            {/* Link */}
            <div className="flex flex-col flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link</label>
              <input
                name="link"
                value={inputFilter.link}
                onChange={handleInputChange}
                placeholder="https://example.com..."
                className="p-2 border rounded text-black placeholder-gray-400 w-full"
              />
            </div>

            {/* Domain */}
            <div className="flex flex-col flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domain</label>
              <Select
                isMulti
                options={availableDomains.map((d) => ({ value: d, label: d }))}
                value={selectedDomains.map((d) => ({ value: d, label: d }))}
                onChange={(selected) => setSelectedDomains(selected.map((s) => s.value))}
                placeholder="Chọn domain..."
                className="text-black"
                styles={{
                  control: (base) => ({
                    ...base,
                    backgroundColor: 'white',
                    borderColor: '#ccc',
                  }),
                }}
              />
            </div>

            {/* Date */}
            <div className="flex flex-col flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timestamp</label>
              <DatePicker
                selectsRange
                startDate={startDate}
                endDate={endDate}
                onChange={(dates) => {
                  const [start, end] = dates as [Date | null, Date | null]
                  setStartDate(start)
                  setEndDate(end)
                }}
                dateFormat="yyyy-MM-dd"
                placeholderText="Chọn khoảng ngày..."
                isClearable
                className="p-2 border rounded w-full text-black placeholder-gray-400 text-sm"
              />
            </div>

            {/* Search button */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-transparent mb-1">.</label>
              <button
                type="submit"
                className="p-2 bg-black text-white font-medium rounded hover:bg-gray-800 whitespace-nowrap"
              >
                Tìm kiếm
              </button>
            </div>
          </form>

          {/* Chart or Table */}
          {viewMode === 'chart' ? (
            <div className="p-4">
              <h3 className="text-lg font-medium mb-3 text-black dark:text-white">
                Biểu đồ: Số quảng cáo theo domain
              </h3>
              {chartData.length === 0 ? (
                <div className="text-center text-gray-500 p-6">Không có dữ liệu</div>
              ) : (
                <div style={{ width: '100%', height: 420 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="domain" hide />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        formatter={(value: number) => [`Số lượng quảng cáo: ${value}`]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Bar dataKey="count" name="Số quảng cáo" barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <>
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
                          Không có dữ liệu
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
            </>
          )}

         {/* Phân trang */}
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
               className="p-2 border rounded w-20 text-center"
             />
             <span className="text-sm text-gray-700 dark:text-gray-300">dòng / trang</span>
           </div>
           <div className="flex items-center gap-2">
             {(() => {
               const pages: (number | string)[] = []
               if (totalPages <= 4) {
                 for (let i = 1; i <= totalPages; i++) pages.push(i)
               } else {
                 pages.push(1)
                 if (page > 2) pages.push('...')
                 const middlePages = [page - 1, page, page + 1].filter(
                   (p) => p > 1 && p < totalPages
                 )
                 pages.push(...middlePages)
                 if (page < totalPages - 1) pages.push('...')
                 pages.push(totalPages)
               }
               return pages.map((p, idx) =>
                 p === '...' ? (
                   <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">
                     ...
                   </span>
                 ) : (
                   <button
                     key={p}
                     onClick={() => setPage(Number(p))}
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
        </div>
      </section>

      {/* Modal xem ảnh */}
      {showModal && selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm"
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
                window.removeEventListener('mousemove', onMouseMove)
                window.removeEventListener('mouseup', onMouseUp)
              }

              window.addEventListener('mousemove', onMouseMove)
              window.addEventListener('mouseup', onMouseUp)
            }}
          >
            <img
              src={selectedImage}
              alt="Full Ad"
              className="rounded shadow-lg transition-transform select-none"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transformOrigin: 'center',
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}
