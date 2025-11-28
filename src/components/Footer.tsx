import { Link } from "react-router-dom";
import voxboxLogoWhite from "@/assets/voxbox-logo-white.png";
import { Github, Twitter, Linkedin, Mail } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-vox-dark text-vox-neutral py-16">
      <div className="container px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            {/* Brand Column */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src={voxboxLogoWhite} alt="VoxBox Logo" className="h-10" />
                <span className="font-heading font-bold text-2xl text-white">VOXBOX</span>
              </div>
              <p className="text-vox-neutral/70 font-sans mb-6">
                Transform your creative vision with the next generation platform.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <Github className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Product Column */}
            <div>
              <h3 className="font-heading font-bold text-lg mb-4 text-white">Product</h3>
              <ul className="space-y-3 font-sans">
                <li><Link to="/features" className="text-vox-neutral/70 hover:text-white transition-colors">Features</Link></li>
                <li><Link to="/pricing" className="text-vox-neutral/70 hover:text-white transition-colors">Pricing</Link></li>
                <li><a href="#" className="text-vox-neutral/70 hover:text-white transition-colors">Use Cases</a></li>
                <li><a href="#" className="text-vox-neutral/70 hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h3 className="font-heading font-bold text-lg mb-4 text-white">Company</h3>
              <ul className="space-y-3 font-sans">
                <li><Link to="/about" className="text-vox-neutral/70 hover:text-white transition-colors">About</Link></li>
                <li><a href="#" className="text-vox-neutral/70 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-vox-neutral/70 hover:text-white transition-colors">Careers</a></li>
                <li><Link to="/contact" className="text-vox-neutral/70 hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>

            {/* Resources Column */}
            <div>
              <h3 className="font-heading font-bold text-lg mb-4 text-white">Resources</h3>
              <ul className="space-y-3 font-sans">
                <li><a href="#" className="text-vox-neutral/70 hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="text-vox-neutral/70 hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#" className="text-vox-neutral/70 hover:text-white transition-colors">Support</a></li>
                <li><a href="#" className="text-vox-neutral/70 hover:text-white transition-colors">Community</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-vox-neutral/60 text-sm font-sans">
                © {currentYear} VoxBox. All rights reserved.
              </p>
              <div className="flex gap-6 text-sm font-sans">
                <a href="#" className="text-vox-neutral/60 hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="text-vox-neutral/60 hover:text-white transition-colors">Terms of Service</a>
                <a href="#" className="text-vox-neutral/60 hover:text-white transition-colors">Cookie Policy</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
