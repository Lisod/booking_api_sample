/* eslint-disable no-undef */
const moment = require('moment');
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTES = 60;
const SLOTS_PER_HOUR = 2;
const SECONDS_PER_SLOT =
  (SECONDS_PER_MINUTES * MINUTES_PER_HOUR) / SLOTS_PER_HOUR;
const TOTAL_TIME_SLOTS_PER_DAY_BY_MINUTES =
  MINUTES_PER_HOUR * HOURS_PER_DAY * SLOTS_PER_HOUR;
const TOTAL_TIME_SLOTS_PER_DAY = HOURS_PER_DAY * SLOTS_PER_HOUR;
const SUNDAY_IN_MOMENT = 7;
const MONDAY_IN_MOMENT = 1;
const FIRST_TIME_SLOT_OF_THE_DAY = 0;

//TODO: missing platform fee, pay pal fee
const PAYPAL_FEE = 0;
const PLATFORM_FEE = 0;
module.exports = {
  friendlyName: 'Book partner',

  description: '',

  inputs: {
    userSubId: {
      type: 'string'
    },
    partnerId: {
      type: 'number'
    },
    start: {
      type: 'number'
    },
    quantity: {
      type: 'number'
    },
    priceOffer: {
      type: 'number'
    },
    payType: {
      type: 'string',
    }
  },

  exits: {
    success: {
      responseType: 'success'
    },
    fail: {
      responseType: 'fail'
    }
  },

  fn: async function ({ start, quantity, priceOffer, userSubId, partnerId }, exits) {
    try {
      let dayOfWeek = getDayOfWeek(start);
      let timeSlotStart = getTimeSlot(start);
      let end = start + quantity * SECONDS_PER_SLOT;

      // loop every time slot to check
      for (let i = 0; i < quantity; i++) {
        let time = checkIfCurrentTimeSlotBiggerThanTotalTimeSlotPerDay(
          timeSlotStart,
          dayOfWeek
        );
        timeSlotStart = time.timeSlotStart;
        dayOfWeek = time.dayOfWeek;
        await checkAvailableTimeOfPartner(
          dayOfWeek,
          start,
          timeSlotStart,
          userSubId
        );
        timeSlotStart++;
      }
      await checkDoubleBooking(partnerId, start, end);

      let booking = await createBooking(
        start,
        quantity,
        priceOffer,
        userSubId,
        partnerId
      );
      // create bill for user
      let userBill = await createBill(
        priceOffer,
        PAYPAL_FEE,
        PLATFORM_FEE,
        userSubId
      );
      let partnerBill = await createPartnerBill(priceOffer, partnerId);
      let data = { booking, userBill, partnerBill };

      return exits.success(data);
    } catch (err) {
      switch (err.message) {
        return exits.fail(err);
    }
  }
}
};
function getDayOfWeek(date) {
  let dayOfWeek = new moment.unix(date).isoWeekday();
  return dayOfWeek;
}
function getTimeSlot(date) {
  let currentHours = new moment.unix(date).format('H');
  let currentMinutes = new moment.unix(date).format('mm');
  let currentTimeToMinutes = currentHours * MINUTES_PER_HOUR + currentMinutes;
  let currentTimeSlot = Math.floor(
    currentTimeToMinutes / TOTAL_TIME_SLOTS_PER_DAY_BY_MINUTES
  );
  return currentTimeSlot;
}
async function checkAvailableTimeOfPartner(
  dayOfWeek,
  timeStamp,
  timeSlot,
  userSubId
) {
  let scheduleTime = await ScheduleSetting.find({
    or: [{ specialDate: timeStamp }, { dayOfWeek: dayOfWeek }],
    user: userSubId,
    slot: timeSlot
  });
  sails.log(scheduleTime);
  if (!scheduleTime[0]) {
    throw new Error(sails.config.status.UNAVAILABLE_TIME);
  } else {
    return true;
  }
}
function checkIfCurrentTimeSlotBiggerThanTotalTimeSlotPerDay(
  timeSlotStart,
  dayOfWeek
) {
  if (timeSlotStart > TOTAL_TIME_SLOTS_PER_DAY) {
    timeSlotStart = FIRST_TIME_SLOT_OF_THE_DAY;
    dayOfWeek = checkIfCurrentDayOfWeekBiggerThanTotalDayOfWeek(dayOfWeek);
  }
  return { timeSlotStart, dayOfWeek };
}
function checkIfCurrentDayOfWeekBiggerThanTotalDayOfWeek(dayOfWeek) {
  dayOfWeek++;
  if (dayOfWeek > SUNDAY_IN_MOMENT) {
    dayOfWeek = MONDAY_IN_MOMENT;
  }
  return dayOfWeek;
}
async function checkDoubleBooking(partnerId, startTimeBooking, endTimeBooking) {
  let exitedRecords = await PlaySchedule.find({
    partner: partnerId,
    isDeleted: false,
    status: { '!=': sails.config.query.WAITING }
  });

  for (let record of exitedRecords) {
    let start = record.startTime;
    let end = start + record.quantity * SECONDS_PER_SLOT;
    switch (startTimeBooking < start) {
      case true:
        sails.log('true startTimeBooking < start');
        switch (endTimeBooking <= start) {
          case false:
            sails.log('false startTimeBooking < start');
            throw new Error(sails.config.status.DUPLICATE_BOOKING);
        }
        break;
      case false:
        switch (startTimeBooking >= end) {
          case false:
            sails.log('false startTimeBooking >= end');
            throw new Error(sails.config.status.DUPLICATE_BOOKING);
        }
        break;
      default:
        throw new Error(sails.config.status.SERVER_ERROR);
    }
  }
  return true;
}
async function createBooking(start, quantity, price, userSubId, partnerId) {
  let offerRecord = await GameOffers.create({
    startTime: start,
    quantity: quantity,
    userPriceOffer: price
  }).fetch();
  await Users.addToCollection(userSubId, 'bookingsOffer').members(
    offerRecord.id
  );
  await Partners.addToCollection(partnerId, 'gameOffers').members(
    offerRecord.id
  );
  return offerRecord;
}
async function createBill(deposit, PAYPAL_FEE, PLATFORM_FEE, userSubId) {
  let bill = await PlayBills.create({
    deposit,
    PAYPAL_FEE,
    PLATFORM_FEE
  }).fetch();
  await Users.addToCollection(userSubId, 'bills').members(bill.id);
  return bill;
}
async function createPartnerBill(withdraw, partnerId) {
  let partnerBill = await PlayBills.create({ withdraw }).fetch();
  let partnerInfo = await Partners.findOne({
    where: { id: partnerId },
    select: 'userId'
  });
  await Users.addToCollection(partnerInfo.id, 'bills').members(partnerBill.id);
  return partnerBill;
}
