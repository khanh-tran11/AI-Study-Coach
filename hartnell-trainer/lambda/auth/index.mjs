// Lambda: POST /auth/login  and  POST /auth/logout
// Demo credentials — swap for Cognito or real DB lookup in production
const CORS = {
  'Access-Control-Allow-Origin':  process.env.FRONTEND_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function ok(body)       { return { statusCode:200, headers:{...CORS,'Content-Type':'application/json'}, body:JSON.stringify(body) }; }
function err(code, msg) { return { statusCode:code, headers:CORS, body:JSON.stringify({error:msg}) }; }

// In production: move to DynamoDB + bcrypt, or replace entirely with Amazon Cognito
const USERS = [
  { id:'1', name:'Admin Owner',         email:'admin@hartnell.edu',    password:'admin123',   role:'admin'   },
  { id:'2', name:'Dr. Maria Santos',    email:'m.santos@hartnell.edu', password:'faculty123', role:'faculty' },
  { id:'3', name:'Prof. James Okafor',  email:'j.okafor@hartnell.edu', password:'faculty123', role:'faculty' },
  { id:'4', name:'Dr. Linda Cheng',     email:'l.cheng@hartnell.edu',  password:'faculty123', role:'faculty' },
  { id:'5', name:'Prof. Ahmed Yusuf',   email:'a.yusuf@hartnell.edu',  password:'faculty123', role:'faculty' },
];

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers:CORS, body:'' };

  const path = event.path ?? '';

  if (path.endsWith('/logout')) return ok({ success:true });

  // login
  let body;
  try { body = JSON.parse(event.body ?? '{}'); } catch { return err(400,'Invalid JSON'); }
  const { email, password } = body;
  const user = USERS.find(u => u.email.toLowerCase() === email?.toLowerCase() && u.password === password);
  if (!user) return err(401, 'Invalid email or password.');
  const { password:_, ...safe } = user;
  return ok({ user: safe });
};
