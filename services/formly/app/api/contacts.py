import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_user_id
from app.models import Contact
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

class ContactCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    groups: List[str] = []

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    groups: Optional[List[str]] = None

@router.get("/")
def list_contacts(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(Contact).filter(Contact.user_id == user_id).order_by(Contact.name).all()

@router.post("/")
def create_contact(data: ContactCreate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    contact = Contact(id=uuid.uuid4(), user_id=user_id, **data.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact

@router.patch("/{contact_id}")
def update_contact(contact_id: str, data: ContactUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.user_id == user_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    db.commit()
    return contact

@router.delete("/{contact_id}")
def delete_contact(contact_id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.user_id == user_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    db.delete(contact)
    db.commit()
    return {"deleted": True}
