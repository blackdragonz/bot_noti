const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const moment = require('moment');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const LINE_ACCESS_TOKEN = 'hPCZ9WXHACzDXR2hv0V/s40fHQ7vuDy0gb1aXXeZt7L5ZqAq6RYACSZYCuIBqw46bflI5OJvRbhIl0LtaM8LFfldRA7VwQecBQrgEYNtp0+fuMGHp/3/Jf0L5+WRUnDPQCz4QXm46sXHc41oCAOvfgdB04t89/1O/w1cDnyilFU='; // เปลี่ยนตรงนี้

app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();

      if (text === 'บอท') {
        await replyMessage(event.replyToken, {
          type: 'text',
          text:
            '📋 ตั้งค่าแจ้งเตือน กรุณากรอกรายการนัดหมาย เช่น:\nหมอนัด 06/06/68 10:30',
        });
      } else if (/^.+\s\d{2}\/\d{2}\/\d{2}\s\d{2}:\d{2}$/.test(text)) {
        const [task, date, time] = parseReminder(text);
        try {
          await db.addReminder(event.source.userId, task, date, time);
          await replyMessage(event.replyToken, {
            type: 'text',
            text: `✅ บันทึกเรียบร้อย: ${task} ${date} ${time}\n📣 จะมีการแจ้งเตือนล่วงหน้า 1 วัน`,
          });
        } catch (error) {
          await replyMessage(event.replyToken, {
            type: 'text',
            text: '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล',
          });
        }
      }
    }
  }

  res.sendStatus(200);
});

function parseReminder(text) {
  const parts = text.split(' ');
  const time = parts.pop();
  const date = parts.pop();
  const task = parts.join(' ');
  return [task, date, time];
}

async function replyMessage(replyToken, message) {
  await axios.post(
    'https://api.line.me/v2/bot/message/reply',
    {
      replyToken,
      messages: [message],
    },
    {
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ตรวจสอบแจ้งเตือนล่วงหน้า 1 วัน ทุกนาที
setInterval(async () => {
  const now = moment();
  const target = now.clone().add(1, 'day').format('DD/MM/YY');

  try {
    const reminders = await db.getRemindersByDate(target);
    for (const item of reminders) {
      await pushMessage(
        item.userId,
        `🔔 แจ้งเตือนล่วงหน้า: ${item.task} พรุ่งนี้ เวลา ${item.time}`
      );
    }
  } catch (error) {
    console.error('Error fetching reminders:', error);
  }
}, 60 * 1000);

async function pushMessage(userId, text) {
  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    {
      to: userId,
      messages: [{ type: 'text', text }],
    },
    {
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

app.get('/', (req, res) => res.send('LINE Reminder Bot is running.'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
