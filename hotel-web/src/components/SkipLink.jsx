/**
 * FAZ 3 / A11y — Skip-to-content link.
 *
 * Klavye kullanan ziyaretciler ilk Tab'da bu link'e ulasir; "Enter"
 * basinca <main id="main"> elemanina atlar — sidebar/header'da gezinmek
 * zorunda kalmaz. Sadece focus alindiginda gorunur (sr-only:focus pattern).
 *
 * Kullanim: App.jsx'in en basinda <SkipLink />, main alaninda id="main".
 */
export default function SkipLink() {
  return (
    <a href="#main"
       className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]
                  focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:text-sm
                  focus:bg-brand-700 focus:text-white focus:shadow-lg focus:outline-none">
      Ana içeriğe atla
    </a>
  )
}
