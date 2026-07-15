import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-primary-50">
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <span className="text-2xl font-bold text-primary">Invogen</span>
        <div className="flex gap-3">
          <Link to="/plans">
            <Button size="sm" variant="outline">Pricing</Button>
          </Link>
          <Link to="/login?portal=admin">
            <Button size="sm">Sign In</Button>
          </Link>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight"
        >
          Beautiful invoices,{' '}
          <span className="text-primary">built your way</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto"
        >
          Drag-and-drop invoice builder for modern businesses. GST-ready templates, multi-tenant workspaces, and premium design.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <Link to="/plans">
            <Button size="lg">View Plans</Button>
          </Link>
          <Link to="/register?portal=admin">
            <Button variant="outline" size="lg">Create Account</Button>
          </Link>
        </motion.div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
        {[
          { icon: FileText, title: 'Drag & Drop Builder', desc: 'Customize every element with our visual invoice editor.' },
          { icon: Users, title: 'Team Workspaces', desc: 'Admin and employee roles with granular permissions.' },
          { icon: Shield, title: 'GST Ready', desc: 'Pre-built templates for Indian tax compliance.' },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="glass p-8 text-center"
          >
            <div className="inline-flex rounded-2xl bg-primary-50 p-4 mb-4">
              <item.icon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-gray-600">{item.desc}</p>
          </motion.div>
        ))}
      </section>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
        <div className="flex justify-center gap-6 mb-4">
          <Link to="/super-admin/login" className="hover:text-primary">Super Admin</Link>
          <Link to="/login?portal=admin" className="hover:text-primary">Admin</Link>
          <Link to="/login?portal=employee" className="hover:text-primary">Employee</Link>
        </div>
        © {new Date().getFullYear()} Invogen. All rights reserved.
      </footer>
    </div>
  );
}
