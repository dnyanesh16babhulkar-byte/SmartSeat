import { motion } from "framer-motion";

interface Props {
  title: string;
  venue: string;
  date: string;
}

export default function EventCard({ title, venue, date }: Props) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="bg-[#0f0f0f] border border-gray-800 rounded-2xl p-5 cursor-pointer"
    >
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-gray-400 mt-1">{venue}</p>
      <p className="text-sm text-gray-500 mt-2">{date}</p>
    </motion.div>
  );
}