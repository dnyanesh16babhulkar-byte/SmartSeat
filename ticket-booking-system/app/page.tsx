"use client";

import { motion } from "framer-motion";
import SearchBar from "@/components/Searchbar";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center text-center">

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl md:text-7xl font-bold tracking-tight"
      >
        Book Your Experience
      </motion.h1>

      {/* Subtitle */}
      <p className="mt-4 text-gray-400 max-w-xl">
        Discover events, reserve premium seats, and enjoy a seamless booking journey.
      </p>

      {/* Search */}
      <div className="mt-10 w-full max-w-2xl">
        <SearchBar />
      </div>

    </main>
  );
}