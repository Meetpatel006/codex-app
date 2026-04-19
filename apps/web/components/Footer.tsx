export function Footer() {
  return (
    <footer id="policy" className="bg-white">
      <div className="mx-auto max-w-[1400px] px-8 py-16 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 lg:grid-cols-3">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-normal text-[#000000]">Codex</span>
            </div>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-[#93939f]">
              Your AI coding companion that runs locally. Secure, encrypted, and always in sync with your desktop.
            </p>
          </div>

          <div>
            <h4 className="text-[14px] font-normal uppercase tracking-wider text-[#93939f]">Product</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <a href="#" className="text-[15px] text-[#000000] hover:text-[#1863dc] transition-colors duration-200">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="text-[15px] text-[#000000] hover:text-[#1863dc] transition-colors duration-200">
                  Download
                </a>
              </li>
              <li>
                <a href="#" className="text-[15px] text-[#000000] hover:text-[#1863dc] transition-colors duration-200">
                  Changelog
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[14px] font-normal uppercase tracking-wider text-[#93939f]">Legal</h4>
            <ul className="mt-4 space-y-3">
              <li>
                <a href="#" className="text-[15px] text-[#000000] hover:text-[#1863dc] transition-colors duration-200">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="text-[15px] text-[#000000] hover:text-[#1863dc] transition-colors duration-200">
                  Terms
                </a>
              </li>
              <li>
                <a href="#" className="text-[15px] text-[#000000] hover:text-[#1863dc] transition-colors duration-200">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[#93939f]">© 2026 Portdex. All rights reserved.</p>
          <p className="text-sm text-[#93939f]">Made by Meet</p>
        </div>
      </div>
    </footer>
  );
}