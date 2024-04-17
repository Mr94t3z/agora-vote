import { Button, Frog } from 'frog'
import { handle } from 'frog/vercel'
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Uncomment this packages to tested on local server
// import { devtools } from 'frog/dev';
// import { serveStatic } from 'frog/serve-static';

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

// Load environment variables from .env file
dotenv.config();

// Set up MySQL connection
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || ''),
});

// Neynar API base URL V2
const baseUrlNeynarV2 = process.env.BASE_URL_NEYNAR_V2;

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api/agora-voting',
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
  imageOptions: {
    /* Other default options */
    fonts: [
      {
        name: 'Arimo',
        source: 'google',

      },
      {
        name: 'Space Mono',
        source: 'google',
      },
    ],    
  },
})

app.frame('/', (c) => {
  return c.res({
    image: (
      <div
          style={{
              alignItems: 'center',
              background: '#000000',
              backgroundSize: '100% 100%',
              display: 'flex',
              flexDirection: 'column',
              flexWrap: 'nowrap',
              height: '100%',
              justifyContent: 'center',
              textAlign: 'center',
              width: '100%',
              color: 'white',
              fontFamily: 'Space Mono',
              fontSize: 35,
              fontStyle: 'normal',
              letterSpacing: '-0.025em',
              lineHeight: 1.4,
              marginTop: 0,
              padding: '0 120px',
              whiteSpace: 'pre-wrap',
          }}
      >
         Press the button below to start voting!
      </div>
    ),
    intents: [
      <Button action='/vote'>⇧ Lets Get Started!</Button>,
    ],
  })
})

// Main voting frame route
app.frame('/vote', async (c) => {
  const { buttonValue, frameData } = c;
  const { fid } = frameData as unknown as { buttonIndex?: number; fid?: string };

  const response = await fetch(`${baseUrlNeynarV2}/user/bulk?fids=${fid}&viewer_fid=${fid}`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'api_key': process.env.NEYNAR_API_KEY || '',
    },
  });

  const data = await response.json();
  const userData = data.users[0];

  // Function to check if the user has already voted
  const hasVoted = async (userId: string): Promise<boolean> => {
    const query = 'SELECT COUNT(*) as count FROM votes WHERE user_id = ?';
    const [rows] = await connection.execute(query, [userId]);
    const typedRows = rows as { count: number }[];
    return typedRows[0].count > 0;
  };


  // Function to record or update the vote in the database
  const recordOrUpdateVote = async (voteType: string, userId: string): Promise<void> => {
    if (await hasVoted(userId)) {
      // Update the existing vote
      const query = 'UPDATE votes SET vote_type = ? WHERE user_id = ?';
      await connection.execute(query, [voteType, userId]);
      console.log(`Vote updated for user ${userId}`);
    } else {
      // Insert a new vote
      const query = 'INSERT INTO votes (vote_type, user_id) VALUES (?, ?)';
      await connection.execute(query, [voteType, userId]);
      console.log(`Vote recorded for user ${userId}`);
    }
  };

  // Check if a button was pressed and record/update the vote
  if (buttonValue) {
    await recordOrUpdateVote(buttonValue, fid ?? '');
  }

  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background: '#000000',
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
          color: 'white',
          fontFamily: 'Space Mono',
          fontSize: 35,
          fontStyle: 'normal',
          letterSpacing: '-0.025em',
          lineHeight: 1.4,
          marginTop: 0,
          padding: '0 120px',
          whiteSpace: 'pre-wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src={userData.pfp_url.toLowerCase().endsWith('.webp') ? '/images/no_avatar.png' : userData.pfp_url}
              style={{
                width: 100,
                height: 100,
                borderRadius: 100,
                boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.5)",
              }}
              width={200} 
              height={200} 
            />
            <span style={{ marginLeft: '25px' }}>Hi, {userData.display_name} 👋🏻</span>
        </div>
        <p>Welcome to Agora Voting! Please vote for or against or abstain from the motion below.</p>
      </div>
    ),
    intents: [
      <Button value='for'>▲ For</Button>,
      <Button value='against'>▲ Against</Button>,
      <Button value='abstain'>▲ Abstain</Button>,
      <Button action='/results'>◉ Result</Button>
    ]
  });
});



app.frame('/results', async (c) => {
  const query = 'SELECT vote_type, COUNT(*) as count FROM votes GROUP BY vote_type';
  // Execute the query and explicitly type the result
  const [rows] = await connection.query(query) as unknown as [any[]];

  let results: Record<string, number> = {};
  rows.forEach(row => {
    results[row.vote_type] = parseInt(row.count, 10); // Ensure count is treated as a number
  });

  const renderedRows = Object.keys(results).map((type) => 
    <p style={{ fontSize: 24, margin : 0 }} key={type}>
      Total vote for {type} is {results[type]}
    </p>
  );

  return c.res({
    image: (
      <div
          style={{
              alignItems: 'center',
              background: '#000000',
              backgroundSize: '100% 100%',
              display: 'flex',
              flexDirection: 'column',
              flexWrap: 'nowrap',
              height: '100%',
              justifyContent: 'center',
              textAlign: 'center',
              width: '100%',
              color: 'white',
              fontFamily: 'Space Mono',
              fontSize: 35,
              fontStyle: 'normal',
              letterSpacing: '-0.025em',
              lineHeight: 1.4,
              marginTop: 0,
              padding: '0 120px',
              whiteSpace: 'pre-wrap',
          }}
      >
        <p>Results</p>
        {renderedRows}
      </div>
    ),
    intents: [ 
      <Button action='/vote'>⏏︎ Back</Button>,
      <Button action='/results'>⌁ Refresh</Button>
    ]
  });
});

// Uncomment for local server testing
// devtools(app, { serveStatic });

export const GET = handle(app)
export const POST = handle(app)
