import React from "react";
import { supabase } from "./supabaseClient";
import { Link } from "react-router-dom";

export default function Navbar() {
  async function signOut() {
    await supabase.auth.signOut();
  }
  return (
    <nav className="sticky top-0 z-50  shadow-xl border-b-4  border-black  bg-orange-100/50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Logo */}
        <div className="text-xl font-bold text-blue-600">
          Friends<span className="text-gray-600">Watch</span>
        </div>

        {/* Links */}
        <ul className="flex space-x-6 text-gray-700 font-medium">
          <li className="hover:text-yellow-500 cursor-pointer">
            <Link to="/">Home</Link>
          </li>
          <li className="hover:text-yellow-500 cursor-pointer">
            <Link to="/you">You</Link>
          </li>

          <button
            onClick={signOut}
            className=" px-4 rounded border-black border-[1px] bg-transparent hover:bg-red-400 hover:text-white cursor-pointer"
          >
            Sign Out
          </button>
        </ul>
      </div>
    </nav>
  );
}
