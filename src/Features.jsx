// OMEGLE VIDEO CHAT & TALK TO STRANGERS
import featureImage from "./assets/features_img1.png";

import React from "react";

const Features = () => {
  return (
    <div className="flex flex-col justify-start items-center min-h-screen w-full gradient-bg2 px-20">
      <h1 className="text-[50px] text-center poppins-bold text-white px-5 pt-8">
        OMEGLE VIDEO CHAT & TALK TO STRANGERS
      </h1>
      <div className="flex justify-start items-center w-full glass rounded-lg h-[450px] mt-10 border-[1px] border-white">
        <div className="w-1/2  flex flex-col justify-center items-center px-10 py-5 gap-5 ">
          <h1 className="text-white poppins-bold  text-[30px] ">
            #1 Random Video Chat Platform
          </h1>
          <p className="text-gray-50 poppins-thin  text-[15px] text-wrap px-5 ">
            Monkey is the premier platform for live video chat, seamlessly
            connecting you with new people both locally and globally. Experience
            Monkey's real-time surprises, authentic excitement, and meaningful
            interactions on any device or web browser—enjoy the same
            exhilarating environment, now with even more ways to engage.
          </p>
          <h1 className="text-white poppins-bold  text-[30px] ">
            New Omegle & OmeTV Alternative
          </h1>
          <p className="text-gray-50 poppins-thin  text-[15px] text-wrap px-5">
            Monkey lets you experience the thrill of random video chat -
            connecting with new people worldwide in real time. It’s a top
            alternative to the original Omegle or any New Omegle platform,
            perfect for those who enjoy spontaneous chats or want to talk to
            strangers
          </p>
        </div>
        <div className="w-1/2  flex justify-center items-center ">
          <img className="" src={featureImage} alt="img" />
        </div>
      </div>
    </div>
  );
};

export default Features;
