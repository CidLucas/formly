import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Enum as SAEnum, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.db import Base
import enum

class SurveyStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"

class QuestionType(str, enum.Enum):
    text_short = "text_short"
    text_long = "text_long"
    multiple_choice = "multiple_choice"
    audio = "audio"
    scale = "scale"
    file_upload = "file_upload"
    nps = "nps"
    ranking = "ranking"
    matrix = "matrix"
    datetime = "datetime"
    number = "number"
    dyn_list = "dyn_list"

class ResponseStatus(str, enum.Enum):
    partial = "partial"
    complete = "complete"

class Survey(Base):
    __tablename__ = "surveys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(String(255), nullable=False)
    slug = Column(String(64), unique=True, nullable=True)
    status = Column(SAEnum(SurveyStatus), default=SurveyStatus.draft)
    theme = Column(String(50), default="default")
    logo_url = Column(String(500), nullable=True)
    brand_colors = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)

    questions = relationship("Question", back_populates="survey", order_by="Question.position")
    responses = relationship("Response", back_populates="survey")

class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    survey_id = Column(UUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False)
    type = Column(SAEnum(QuestionType), nullable=False)
    title = Column(Text, nullable=False)
    required = Column(Boolean, default=False)
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    survey = relationship("Survey", back_populates="questions")
    answers = relationship("Answer", back_populates="question")

class Response(Base):
    __tablename__ = "responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    survey_id = Column(UUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    respondent_ref = Column(String(64), nullable=True)
    status = Column(SAEnum(ResponseStatus), default=ResponseStatus.partial)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    time_spent_secs = Column(Integer, nullable=True)

    survey = relationship("Survey", back_populates="responses")
    answers = relationship("Answer", back_populates="response")

class Answer(Base):
    __tablename__ = "answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id = Column(UUID(as_uuid=True), ForeignKey("responses.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    value_text = Column(Text, nullable=True)
    value_choices = Column(JSON, nullable=True)
    scale_value = Column(Integer, nullable=True)
    audio_url = Column(String(500), nullable=True)
    transcription = Column(Text, nullable=True)
    file_url = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    response = relationship("Response", back_populates="answers")
    question = relationship("Question", back_populates="answers")

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    groups = Column(ARRAY(String), default=[])
    created_at = Column(DateTime, default=datetime.utcnow)
