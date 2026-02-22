import React from "react";
import { IoMenuOutline, IoSettingsOutline } from "react-icons/io5";

export const Header: React.FC<{ title: string }> = ({ title }) => {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-gray-100 bg-white sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-2">
        <button className="md:hidden text-gray-500 hover:text-gray-700 active:scale-95 transition-transform">
          <IoMenuOutline className="text-2xl" />
        </button>

        <h1 className="text-lg font-bold text-teal-500 tracking-tight">
          {title}
        </h1>
      </div>

      <button className="text-gray-400 hover:text-gray-600">
        <IoSettingsOutline className="text-lg" />
      </button>
    </header>
  );
};