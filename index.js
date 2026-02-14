require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

/* ===== MODELS ===== */

const Session = mongoose.model("Session", new mongoose.Schema({
  robloxUserId:String,
  startTime:Number,
  active:Boolean
}));

const Monthly = mongoose.model("Monthly", new mongoose.Schema({
  robloxUserId:String,
  minutes:{type:Number,default:0},
  month:String
}));

const Total = mongoose.model("Total", new mongoose.Schema({
  robloxUserId:String,
  minutes:{type:Number,default:0}
}));

const Streak = mongoose.model("Streak", new mongoose.Schema({
  robloxUserId:String,
  lastDate:String,
  days:{type:Number,default:0}
}));

const Verify = mongoose.model("Verify", new mongoose.Schema({
  robloxUserId:String,
  discordId:String,
  code:String,
  expires:Number
}));

const Link = mongoose.model("Link", new mongoose.Schema({
  discordId:String,
  robloxUserId:String
}));

/* ===== HELPERS ===== */

const monthKey=()=>{
 const d=new Date();
 return `${d.getFullYear()}-${d.getMonth()+1}`;
};

const todayKey=()=>new Date().toISOString().slice(0,10);

const auth=(req,res,next)=>{
 if(req.headers["x-api-key"]!==process.env.API_KEY) return res.sendStatus(403);
 next();
};

/* ===== PLAYTIME ===== */

app.post("/join",auth,async(req,res)=>{
 await Session.deleteMany({robloxUserId:req.body.userId});

 await Session.create({
  robloxUserId:req.body.userId,
  startTime:Date.now(),
  active:true
 });

 res.sendStatus(200);
});

app.post("/leave",auth,async(req,res)=>{
 const s=await Session.findOne({robloxUserId:req.body.userId,active:true});
 if(!s) return res.sendStatus(404);

 const minutes=Math.max(1,Math.floor((Date.now()-s.startTime)/60000));

 await Monthly.updateOne(
  {robloxUserId:req.body.userId,month:monthKey()},
  {$inc:{minutes}},
  {upsert:true}
 );

 await Total.updateOne(
  {robloxUserId:req.body.userId},
  {$inc:{minutes}},
  {upsert:true}
 );

 const today=todayKey();
 const streak=await Streak.findOne({robloxUserId:req.body.userId});

 if(!streak){
  await Streak.create({robloxUserId:req.body.userId,lastDate:today,days:1});
 }
 else if(streak.lastDate < today){
  streak.days++;
  streak.lastDate=today;
  await streak.save();
 }

 await Session.deleteMany({robloxUserId:req.body.userId});

 res.sendStatus(200);
});

/* ===== LINKING ===== */

app.post("/verify/start",auth,async(req,res)=>{
 const code="HUTCH-"+Math.floor(1000+Math.random()*9000);

 await Verify.create({
  robloxUserId:req.body.userId,
  discordId:req.body.discordId,
  code,
  expires:Date.now()+5*60*1000
 });

 res.json({code});
});

app.post("/verify/confirm",auth,async(req,res)=>{
 const v=await Verify.findOne({
  robloxUserId:req.body.userId,
  code:req.body.code,
  expires:{$gt:Date.now()}
 });

 if(!v) return res.sendStatus(403);

 await Link.updateOne(
  {robloxUserId:req.body.userId},
  {robloxUserId:req.body.userId,discordId:v.discordId},
  {upsert:true}
 );

 await Verify.deleteMany({robloxUserId:req.body.userId});

 res.sendStatus(200);
});

app.listen(process.env.PORT||3000,()=>console.log("Backend running"));
